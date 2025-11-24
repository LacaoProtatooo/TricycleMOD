#!/usr/bin/env python
import sys, os, json
# Debug: print runtime python and environment for diagnosing import issues
sys.stderr.write(json.dumps({
    'debug_python': sys.executable,
    'debug_sys_path': sys.path[:5],            # truncated
    'debug_virtual_env': os.environ.get('VIRTUAL_ENV'),
    'debug_path_env_contains_venv': '.venv' in os.environ.get('PATH', '')
}) + "\n")

import tempfile

# This script requires paddleocr, paddlepaddle and Pillow installed in the same python environment.
# Usage: python paddle_scan.py /path/to/image.jpg [--lang <lang>] [--no-cls]
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
    Enhanced to capture all text more comprehensively.
    """
    if isinstance(obj, dict):
        if 'text' in obj or 'rec_text' in obj or 'transcription' in obj:
            text = obj.get('text') or obj.get('rec_text') or obj.get('transcription') or ''
            # Only add if text is not empty
            if text and text.strip():
                conf = obj.get('confidence') or obj.get('score') or obj.get('prob') or obj.get('score_list')
                box = obj.get('box') or obj.get('bbox') or obj.get('loc') or obj.get('box_points')
                out.append({
                    'text': make_serializable(text),
                    'confidence': make_serializable(conf),
                    'box': make_serializable(box)
                })
            return
        # Also check for arrays of texts/boxes
        if 'texts' in obj and 'boxes' in obj:
            texts = obj.get('texts', [])
            boxes = obj.get('boxes', [])
            for i, text in enumerate(texts):
                if text and text.strip():
                    box = boxes[i] if i < len(boxes) else None
                    conf = obj.get('scores', [None])[i] if 'scores' in obj and i < len(obj.get('scores', [])) else None
                    out.append({
                        'text': make_serializable(text),
                        'confidence': make_serializable(conf),
                        'box': make_serializable(box)
                    })
            return
        for v in obj.values():
            extract_texts(v, out)
    elif isinstance(obj, (list, tuple)):
        # Handle PaddleOCR standard format: [[[x1,y1],[x2,y2],[x3,y3],[x4,y4]], (text, confidence)]
        if len(obj) >= 2:
            first, second = obj[0], obj[1]
            # Standard format: [bbox, (text, confidence)]
            if isinstance(second, (list, tuple)) and len(second) >= 1:
                if isinstance(second[0], str):
                    text = second[0]
                    if text and text.strip():  # Only add non-empty text
                        conf = second[1] if len(second) > 1 else None
                        out.append({'text': make_serializable(text), 'confidence': make_serializable(conf), 'box': make_serializable(first)})
                    return
                # Nested structure
                if isinstance(second, (list, tuple)) and len(second) > 0:
                    # Try to extract text from nested structure
                    for item in second:
                        extract_texts([first, item], out)
                    return
            # Direct text string
            if isinstance(second, str):
                if second and second.strip():  # Only add non-empty text
                    out.append({'text': make_serializable(second), 'confidence': None, 'box': make_serializable(first)})
                return
            # Dict with text keys
            if isinstance(second, dict) and any(k in second for k in ('text', 'rec_text', 'transcription')):
                text = second.get('text') or second.get('rec_text') or second.get('transcription') or ''
                if text and text.strip():  # Only add non-empty text
                    conf = second.get('confidence') or second.get('score')
                    out.append({'text': make_serializable(text), 'confidence': make_serializable(conf), 'box': make_serializable(first)})
                return
        # Recursively process all items
        for item in obj:
            extract_texts(item, out)


def preprocess_image(in_path, max_width=1600, contrast=1.2, enhance_sharpness=1.0, to_grayscale=False):
    """
    Preprocess the image: resize (if large), enhance contrast/sharpness, optional grayscale.
    Returns path to temp preprocessed image.
    Enhanced to preserve more detail for better OCR.
    """
    img = Image.open(in_path).convert('RGB')
    w, h = img.size
    
    # Only resize if significantly larger than max_width to preserve detail
    if max(w, h) > max_width:
        scale = max_width / float(max(w, h))
        new_size = (int(w * scale), int(h * scale))
        # Use LANCZOS for better quality when downscaling
        img = img.resize(new_size, Image.LANCZOS)
    
    # Optional grayscale conversion (usually better to keep color for OCR)
    if to_grayscale:
        img = ImageOps.grayscale(img).convert('RGB')
    
    # Enhance contrast to make text more distinct
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    
    # Enhance sharpness to make text edges clearer
    if enhance_sharpness != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(enhance_sharpness)
    
    # Save with high quality to preserve detail
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
    tmp_path = tmp.name
    tmp.close()
    img.save(tmp_path, quality=98, optimize=False)  # Higher quality, no optimization for speed
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
            # upscale for better recognition
            cw, ch = crop.size
            if cw > 0 and ch > 0:  # Ensure valid dimensions
                crop = crop.resize((int(cw * upscale), int(ch * upscale)), Image.LANCZOS)
            # save to temp and run OCR on crop
            tmpc = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            tmpc_path = tmpc.name
            tmpc.close()
            crop.save(tmpc_path, quality=98, optimize=False)  # Higher quality
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


def run_tesseract_fullpage(image_path):
    """
    Optional fallback using pytesseract to read the whole page as plain text.
    Returns (list_of_items, error_str). list_of_items is [{'text':..., 'confidence':None, 'box':None}, ...]
    """
    try:
        import pytesseract
        import shutil
        from PIL import ImageFilter
    except Exception as e:
        return None, f"pytesseract or PIL.ImageFilter not available: {e}"
    # Prefer system PATH first
    tpath = shutil.which('tesseract')
    if not tpath:
        # Try common Windows install locations as a fallback
        candidates = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]
        found = None
        for c in candidates:
            try:
                if os.path.exists(c):
                    found = c
                    break
            except Exception:
                continue
        if found:
            pytesseract.pytesseract.tesseract_cmd = found
        else:
            return None, "tesseract executable not found in PATH or known install locations"
    try:
        img = Image.open(image_path).convert('RGB')
        # simple preprocessing to help Tesseract
        gray = ImageOps.grayscale(img)
        gray = gray.filter(ImageFilter.MedianFilter(size=3))
        gray = ImageOps.autocontrast(gray)
        # get full-page text (psm 1 = automatic page segmentation + OSD)
        text = pytesseract.image_to_string(gray, lang='eng', config='--psm 1')
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        items = [{'text': make_serializable(ln), 'confidence': None, 'box': None} for ln in lines]
        return items, None
    except Exception as e:
        return None, str(e)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No image path provided'}))
        sys.exit(1)

    img_path = sys.argv[1]
    if not os.path.exists(img_path):
        print(json.dumps({'error': 'Image not found', 'path': img_path}))
        sys.exit(1)

    # Parse optional arguments: --lang / -l and --no-cls
    lang = 'en'
    use_cls = True
    for i in range(2, len(sys.argv)):
        a = sys.argv[i].lower()
        if a in ('--lang', '-l') and i + 1 < len(sys.argv):
            lang = sys.argv[i + 1]
        if a == '--no-cls':
            use_cls = False

    # Debug chosen lang and cls usage
    sys.stderr.write(json.dumps({'debug_chosen_lang': lang, 'debug_use_cls': use_cls}) + "\n")

    # create OCR model with correct modern parameters - optimized for maximum text detection
    # Using only validated parameters to avoid compatibility issues
    ocr = PaddleOCR(
        lang=lang,
        text_det_thresh=0.2,  # Lower threshold to detect more text (was 0.3)
        text_det_box_thresh=0.3,  # Lower box threshold to include more boxes (was 0.5)
        text_det_unclip_ratio=2.0  # Expand detected boxes more to capture full text (was 1.8)
    )

    # preprocess full image to help detection - keep higher resolution for better text detection
    pre_path = preprocess_image(img_path, max_width=3200, contrast=1.3, enhance_sharpness=1.1, to_grayscale=False)

    try:
        # detection + recognition on preprocessed image
        try:
            if use_cls:
                raw_result = ocr.ocr(pre_path, cls=True)
            else:
                raw_result = ocr.ocr(pre_path)
        except Exception:
            # fallback without cls
            raw_result = ocr.ocr(pre_path)
    except Exception as e:
        # cleanup
        try:
            os.unlink(pre_path)
        except Exception:
            pass
        print(json.dumps({'error': 'OCR failed', 'detail': str(e)}))
        sys.exit(3)

    # DEBUG: Print raw result structure to stderr
    import sys as _sys
    _sys.stderr.write(f"\n=== DEBUG: Raw result type: {type(raw_result)} ===\n")
    _sys.stderr.write(f"=== DEBUG: Raw result length: {len(raw_result) if isinstance(raw_result, (list, tuple)) else 'N/A'} ===\n")
    _sys.stderr.write(f"=== DEBUG: Raw result: {str(raw_result)[:500]} ===\n\n")

    # Handle None or empty results
    if raw_result is None:
        try:
            os.unlink(pre_path)
        except Exception:
            pass
        print(json.dumps({'error': 'OCR returned no results', 'detail': 'PaddleOCR returned None'}))
        sys.exit(3)

    # PaddleOCR standard format: list of detections where each is [bbox, (text, confidence)]
    # For multi-page: [[page1_detections], [page2_detections], ...]
    # For single page: [detection1, detection2, ...]
    # Handle multi-page format by flattening
    if isinstance(raw_result, (list, tuple)) and len(raw_result) > 0:
        # Check if it's a list of pages (each page is a list of detections)
        if isinstance(raw_result[0], (list, tuple)) and len(raw_result[0]) > 0:
            # Check if first page's first element looks like a detection [bbox, text_info]
            first_item = raw_result[0][0]
            if isinstance(first_item, (list, tuple)) and len(first_item) >= 2:
                # This is multi-page format, flatten it
                flattened = []
                for page in raw_result:
                    if page is not None and isinstance(page, (list, tuple)):
                        flattened.extend(page)
                raw_result = flattened
        # Handle case where first element is None (empty result)
        elif raw_result[0] is None:
            raw_result = []

    # Attempt to extract lines from raw_result - this is the primary source
    extracted = []
    extract_texts(raw_result, extracted)
    
    _sys.stderr.write(f"=== DEBUG: Extracted {len(extracted)} lines from raw result ===\n")
    
    # Remove duplicates based on text content (keep first occurrence)
    seen_texts = set()
    unique_extracted = []
    for item in extracted:
        text = item.get('text', '').strip() if item.get('text') else ''
        if text and text not in seen_texts:
            seen_texts.add(text)
            unique_extracted.append(item)
    
    _sys.stderr.write(f"=== DEBUG: After deduplication: {len(unique_extracted)} unique lines ===\n")

    # Normalize detections and perform per-box crop + re-recognition from the original (higher res) image
    # This is optional enhancement - use extracted as primary source
    crops_result = []
    try:
        detections = flatten_detections(raw_result)
        # fallback: if flatten_detections found nothing and raw_result looks like a list of boxes, use it directly
        if not detections and isinstance(raw_result, (list, tuple)):
            detections = list(raw_result)
        
        _sys.stderr.write(f"=== DEBUG: Found {len(detections)} detections for cropping ===\n")
        
        if detections:
            crops_result = crop_and_rerun_ocr(ocr, img_path, detections, crop_padding=8, upscale=2.5)
            _sys.stderr.write(f"=== DEBUG: Crop processing returned {len(crops_result)} results ===\n")
    except Exception as ex:
        _sys.stderr.write(f"=== DEBUG: Crop processing failed: {str(ex)} ===\n")
        crops_result = []

    # Merge results: use extracted as primary, supplement with crop results if they add new text
    lines = unique_extracted.copy()
    if crops_result:
        extracted_texts = {item.get('text', '').strip() for item in lines if item.get('text')}
        for crop_item in crops_result:
            crop_text = crop_item.get('text', '').strip() if crop_item.get('text') else ''
            if crop_text and crop_text not in extracted_texts:
                lines.append(crop_item)
                extracted_texts.add(crop_text)
    
    _sys.stderr.write(f"=== DEBUG: Final merged result: {len(lines)} total lines ===\n")

    # If result is very small (1 line) try full-page fallback with Tesseract
    if len(lines) <= 1:
        _sys.stderr.write("=== DEBUG: PaddleOCR returned few lines, trying Tesseract full-page fallback ===\n")
        t_lines, t_err = run_tesseract_fullpage(img_path)
        if t_lines:
            _sys.stderr.write(f"=== DEBUG: Tesseract returned {len(t_lines)} lines; replacing result ===\n")
            lines = t_lines
        else:
            _sys.stderr.write(f"=== DEBUG: Tesseract fallback failed: {t_err} ===\n")

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
