#!/usr/bin/env python
import sys
import json
import os
import tempfile

# This script requires paddleocr, paddlepaddle and Pillow installed in the same python environment.
# Usage: python paddle_scan.py /path/to/image.jpg
# Install deps in your server venv:
# pip install paddleocr paddlepaddle pillow

try:
    from paddleocr import PaddleOCR
except Exception as e:
    print(json.dumps({'error': 'Missing dependency paddleocr or paddlepaddle', 'detail': str(e)}))
    sys.exit(2)

try:
    import paddle
except Exception as e:
    print(json.dumps({
        'error': 'Missing dependency paddle',
        'detail': str(e),
        'hint': 'Activate the server venv and install paddlepaddle and paddleocr: pip install paddlepaddle -f https://www.paddlepaddle.org.cn/whl/windows/mkl/avx/stable.html && pip install paddleocr'
    }))
    sys.exit(2)

try:
    from PIL import Image, ImageEnhance, ImageOps
except Exception as e:
    print(json.dumps({
        'error': 'Missing dependency Pillow',
        'detail': str(e),
        'hint': 'Install Pillow in the server venv: pip install pillow'
    }))
    sys.exit(2)


def make_serializable(obj):
    try:
        if obj is None or isinstance(obj, (str, bool, int, float)):
            return obj
        if hasattr(obj, 'tolist'):
            try:
                return make_serializable(obj.tolist())
            except Exception:
                return str(obj)
        if isinstance(obj, dict):
            return {str(k): make_serializable(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple, set)):
            return [make_serializable(v) for v in obj]
        return str(obj)
    except Exception:
        return str(obj)


def extract_texts(obj, out):
    """
    Recursively extract candidate text lines from varied PaddleOCR outputs.
    Appends dicts with keys: text, confidence, box when possible.
    """
    if isinstance(obj, dict):
        if 'text' in obj or 'rec_text' in obj or 'transcription' in obj:
            text = obj.get('text') or obj.get('rec_text') or obj.get('transcription') or ''
            conf = obj.get('confidence') or obj.get('score') or obj.get('prob') or obj.get('score_list')
            box = obj.get('box') or obj.get('bbox') or obj.get('loc') or obj.get('box_points')
            out.append({
                'text': make_serializable(text),
                'confidence': make_serializable(conf),
                'box': make_serializable(box)
            })
            return
        for v in obj.values():
            extract_texts(v, out)
    elif isinstance(obj, (list, tuple)):
        if len(obj) >= 2:
            first, second = obj[0], obj[1]
            if isinstance(second, (list, tuple)) and len(second) >= 1 and isinstance(second[0], str):
                text = second[0]
                conf = second[1] if len(second) > 1 else None
                out.append({'text': make_serializable(text), 'confidence': make_serializable(conf), 'box': make_serializable(first)})
                return
            if isinstance(second, str):
                out.append({'text': make_serializable(second), 'confidence': None, 'box': make_serializable(first)})
                return
            if isinstance(second, dict) and any(k in second for k in ('text', 'rec_text', 'transcription')):
                text = second.get('text') or second.get('rec_text') or second.get('transcription') or ''
                conf = second.get('confidence') or second.get('score')
                out.append({'text': make_serializable(text), 'confidence': make_serializable(conf), 'box': make_serializable(first)})
                return
        for item in obj:
            extract_texts(item, out)


def preprocess_image(in_path, max_width=1600, contrast=1.2, enhance_sharpness=1.0, to_grayscale=False):
    """
    Preprocess the image: resize (if large), enhance contrast/sharpness, optional grayscale.
    Returns path to temp preprocessed image.
    """
    img = Image.open(in_path).convert('RGB')
    w, h = img.size
    if max(w, h) > max_width:
        scale = max_width / float(max(w, h))
        new_size = (int(w * scale), int(h * scale))
        img = img.resize(new_size, Image.LANCZOS)
    if to_grayscale:
        img = ImageOps.grayscale(img).convert('RGB')
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    if enhance_sharpness != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(enhance_sharpness)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
    tmp_path = tmp.name
    tmp.close()
    img.save(tmp_path, quality=95)
    return tmp_path


# NEW: normalize/flatten detections returned by different PaddleOCR versions
def flatten_detections(result):
    """
    Return a flat list of detection items where each item is [bbox, rec_info] or a dict with bbox/text.
    Works with various output shapes from predict() / ocr().
    """
    detections = []

    def is_bbox_like(obj):
        if not isinstance(obj, (list, tuple)):
            return False
        if len(obj) >= 4 and all(isinstance(pt, (list, tuple)) and len(pt) >= 2 for pt in obj[:4]):
            return True
        return False

    def collect(obj):
        # direct list like [bbox, rec]
        if isinstance(obj, (list, tuple)):
            if len(obj) >= 2 and is_bbox_like(obj[0]):
                detections.append([obj[0], obj[1]])
                return
            # some versions return [[bbox,...], ...] or nested pages
            for item in obj:
                collect(item)
        elif isinstance(obj, dict):
            # dict that has bbox/text keys
            bbox_keys = ('bbox', 'box', 'box_points', 'loc', 'points')
            text_keys = ('text', 'rec_text', 'transcription', 'predict', 'predict_text')
            found_bbox = None
            found_text = None
            for k in bbox_keys:
                if k in obj:
                    found_bbox = obj[k]
                    break
            for k in text_keys:
                if k in obj:
                    found_text = obj[k]
                    break
            # some forms have 'boxes' and 'texts' arrays
            if found_bbox is not None and found_text is not None:
                detections.append([found_bbox, {'text': found_text}])
                return
            # handle arrays in dict
            for v in obj.values():
                collect(v)
        # else ignore

    collect(result)
    return detections


def crop_and_rerun_ocr(ocr, original_image_path, detections, crop_padding=6, upscale=2.0):
    """
    Given PaddleOCR detections (list of [bbox, rec]) crop each bbox from original image,
    upscale it and run OCR again on the crop to improve recognition accuracy.
    Returns list of {text,confidence,box}.
    """
    results = []
    orig_img = Image.open(original_image_path).convert('RGB')
    ow, oh = orig_img.size

    for det in detections:
        try:
            if not isinstance(det, (list, tuple)) or len(det) < 1:
                continue
            bbox = det[0]
            # bbox often is list of 4 points [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            pts = []
            for p in bbox:
                try:
                    x, y = float(p[0]), float(p[1])
                except Exception:
                    # fallback if structured differently
                    continue
                pts.append((x, y))
            if not pts:
                continue
            xs = [int(max(0, round(x))) for x, y in pts]
            ys = [int(max(0, round(y))) for x, y in pts]
            minx, maxx = max(min(xs) - crop_padding, 0), min(max(xs) + crop_padding, ow)
            miny, maxy = max(min(ys) - crop_padding, 0), min(max(ys) + crop_padding, oh)
            if minx >= maxx or miny >= maxy:
                continue
            crop = orig_img.crop((minx, miny, maxx, maxy))
            # upscale
            cw, ch = crop.size
            crop = crop.resize((int(cw * upscale), int(ch * upscale)), Image.LANCZOS)
            # save to temp and run OCR on crop
            tmpc = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            tmpc_path = tmpc.name
            tmpc.close()
            crop.save(tmpc_path, quality=95)
            try:
                rec = None
                # prefer predict where available
                try:
                    rec = ocr.predict(tmpc_path)
                except Exception:
                    rec = ocr.ocr(tmpc_path)
                # try to extract text from rec (it may be nested)
                extracted = []
                extract_texts(rec, extracted)
                if extracted:
                    # take first extracted item from crop
                    r = extracted[0]
                    # ensure box refers to original bbox
                    r['box'] = make_serializable(bbox)
                    results.append(r)
                else:
                    # fallback: record raw rec
                    results.append({'text': None, 'confidence': None, 'box': make_serializable(bbox), 'raw': make_serializable(rec)})
            finally:
                try:
                    os.unlink(tmpc_path)
                except Exception:
                    pass
        except Exception:
            continue

    return results


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No image path provided'}))
        sys.exit(1)

    img_path = sys.argv[1]
    if not os.path.exists(img_path):
        print(json.dumps({'error': 'Image not found', 'path': img_path}))
        sys.exit(1)

    # create OCR model (tweak params if desired)
    ocr = PaddleOCR(use_textline_orientation=True, lang='en')

    # preprocess full image to help detection
    pre_path = preprocess_image(img_path, max_width=1600, contrast=1.25, enhance_sharpness=1.0, to_grayscale=False)

    try:
        # detection + recognition on preprocessed image
        try:
            raw_result = ocr.predict(pre_path)
        except Exception:
            raw_result = ocr.ocr(pre_path)
    except Exception as e:
        # cleanup
        try:
            os.unlink(pre_path)
        except Exception:
            pass
        print(json.dumps({'error': 'OCR failed', 'detail': str(e)}))
        sys.exit(3)

    # Attempt to extract lines from raw_result
    extracted = []
    extract_texts(raw_result, extracted)

    # If detection found bounding boxes (raw_result elements typically include bbox in first element),
    # perform per-box crop + re-recognition from the original (higher res) image to improve accuracy.
    # Use raw_result itself for detection coordinates if available.
    try:
        crops_result = crop_and_rerun_ocr(ocr, img_path, raw_result, crop_padding=6, upscale=2.0)
    except Exception:
        crops_result = []

    # Merge crop-based results if they exist; otherwise fall back to extracted
    lines = crops_result if crops_result else extracted

    # If still empty, return raw for debugging
    if not lines:
        print(json.dumps({
            'lines': [],
            'warning': 'No text lines extracted. Raw result included for debugging.',
            'raw': make_serializable(raw_result)
        }, ensure_ascii=False))
        try:
            os.unlink(pre_path)
        except Exception:
            pass
        sys.exit(0)

    print(json.dumps({'lines': make_serializable(lines)}, ensure_ascii=False))
    try:
        os.unlink(pre_path)
    except Exception:
        pass


if __name__ == '__main__':
    main()
