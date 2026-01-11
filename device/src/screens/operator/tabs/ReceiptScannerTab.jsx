import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  RefreshControl
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import styles from '../operatorStyles';
import { createImageFormData } from '../operatorHelpers';
import { scanReceipt, saveReceipt, fetchReceipts, deleteReceipt } from '../../../redux/actions/operatorAction';
import { clearReceiptResult } from '../../../redux/reducers/operatorReducer';
import { useDispatch, useSelector } from 'react-redux';

// Categories for receipts
const CATEGORIES = [
  { id: 'fuel', label: 'Fuel/Gas', icon: 'gas-station', color: '#e74c3c' },
  { id: 'maintenance', label: 'Maintenance', icon: 'wrench', color: '#3498db' },
  { id: 'parts', label: 'Parts', icon: 'cog', color: '#9b59b6' },
  { id: 'registration', label: 'Registration', icon: 'file-document', color: '#2ecc71' },
  { id: 'insurance', label: 'Insurance', icon: 'shield-check', color: '#1abc9c' },
  { id: 'cleaning', label: 'Cleaning', icon: 'spray-bottle', color: '#f39c12' },
  { id: 'other', label: 'Other', icon: 'dots-horizontal', color: '#95a5a6' },
];

// Smart parser for receipt text
const parseReceiptData = (ocrResult) => {
  if (!ocrResult?.lines || ocrResult.lines.length === 0) {
    return { vendorName: '', totalAmount: '', receiptDate: '', items: [] };
  }

  const lines = ocrResult.lines.map(l => (l.text || l.raw || '').toString().trim()).filter(Boolean);
  const fullText = lines.join('\n').toLowerCase();
  
  let vendorName = '';
  let totalAmount = '';
  let receiptDate = '';
  const items = [];

  // Extract vendor name (usually first non-empty line or prominent text)
  const vendorKeywords = ['station', 'store', 'shop', 'mart', 'service', 'center', 'gas', 'petron', 'shell', 'caltex', 'phoenix', 'seaoil', 'jetti', 'total', 'unioil'];
  for (const line of lines.slice(0, 5)) {
    const lowerLine = line.toLowerCase();
    if (vendorKeywords.some(kw => lowerLine.includes(kw)) || (line.length > 3 && line.length < 40 && !line.match(/^\d/))) {
      vendorName = line;
      break;
    }
  }
  if (!vendorName && lines.length > 0) {
    vendorName = lines[0];
  }

  // Extract total amount - look for keywords
  const totalPatterns = [
    /total[:\s]*[₱P$]?\s*([\d,]+\.?\d*)/i,
    /amount[:\s]*[₱P$]?\s*([\d,]+\.?\d*)/i,
    /grand\s*total[:\s]*[₱P$]?\s*([\d,]+\.?\d*)/i,
    /due[:\s]*[₱P$]?\s*([\d,]+\.?\d*)/i,
    /[₱P]\s*([\d,]+\.?\d*)/,
    /([\d,]+\.\d{2})$/m
  ];

  for (const pattern of totalPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      totalAmount = match[1].replace(/,/g, '');
      break;
    }
  }

  // If no total found, look for the largest number
  if (!totalAmount) {
    const numbers = fullText.match(/[\d,]+\.?\d*/g) || [];
    const numericValues = numbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n) && n > 0);
    if (numericValues.length > 0) {
      totalAmount = Math.max(...numericValues).toString();
    }
  }

  // Extract date
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{1,2},?\s*\d{2,4}/i,
    /(\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4})/i
  ];

  for (const pattern of datePatterns) {
    const match = fullText.match(pattern);
    if (match) {
      receiptDate = match[0];
      break;
    }
  }

  // Extract line items (lines with prices)
  const itemPattern = /(.+?)\s+[₱P$]?\s*([\d,]+\.?\d*)\s*$/;
  for (const line of lines) {
    if (line.toLowerCase().includes('total') || line.toLowerCase().includes('change')) continue;
    const match = line.match(itemPattern);
    if (match && match[2]) {
      const amount = parseFloat(match[2].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0 && amount < 100000) {
        items.push({
          description: match[1].trim(),
          amount: amount
        });
      }
    }
  }

  return { vendorName, totalAmount, receiptDate, items };
};

// Auto-suggest category based on text
const suggestCategory = (ocrResult, vendorName) => {
  const text = [
    vendorName,
    ...(ocrResult?.lines?.map(l => l.text || '') || [])
  ].join(' ').toLowerCase();

  if (/gas|fuel|petrol|diesel|unleaded|petron|shell|caltex|phoenix|seaoil|jetti|total|unioil/i.test(text)) {
    return 'fuel';
  }
  if (/oil\s*change|repair|service|mechanic|tune[\s-]*up|brake|alignment|wash|cleaning/i.test(text)) {
    return 'maintenance';
  }
  if (/tire|battery|bulb|filter|spark\s*plug|belt|parts|accessory/i.test(text)) {
    return 'parts';
  }
  if (/lto|registration|franchise|permit|license/i.test(text)) {
    return 'registration';
  }
  if (/insurance|policy|premium/i.test(text)) {
    return 'insurance';
  }
  if (/clean|wash|detail|wax|polish/i.test(text)) {
    return 'cleaning';
  }
  return 'other';
};

// Format currency
const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Get relative time
const getRelativeTime = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

export default function ReceiptScannerTab({ 
  token, 
  BACKEND, 
  receiptResult, 
  loadingReceipt, 
  errorReceipt,
  tricycles = []
}) {
  const dispatch = useDispatch();
  const { receipts, loadingReceipts, savingReceipt, categoryTotals } = useSelector(state => state.operator);
  
  // View state: 'scan' or 'history'
  const [activeView, setActiveView] = useState('scan');
  
  // Scanner state
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  
  // Editable form state
  const [showEditForm, setShowEditForm] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [selectedTricycle, setSelectedTricycle] = useState(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  
  // History filter
  const [historyFilter, setHistoryFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  
  // Receipt detail modal
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Load receipts on mount and when filter changes
  useEffect(() => {
    if (token && BACKEND) {
      loadReceipts();
    }
  }, [token, BACKEND, historyFilter]);

  // When OCR result comes in, parse and populate form
  useEffect(() => {
    if (receiptResult) {
      const parsed = parseReceiptData(receiptResult);
      setVendorName(parsed.vendorName || '');
      setTotalAmount(parsed.totalAmount || '');
      setReceiptDate(parsed.receiptDate || new Date().toISOString().split('T')[0]);
      setItems(parsed.items || []);
      
      // Auto-suggest category
      const suggested = suggestCategory(receiptResult, parsed.vendorName);
      setSelectedCategory(suggested);
      
      setShowEditForm(true);
    }
  }, [receiptResult]);

  const loadReceipts = async () => {
    const filters = historyFilter !== 'all' ? { category: historyFilter } : {};
    dispatch(fetchReceipts({ token, BACKEND, filters }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReceipts();
    setRefreshing(false);
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is needed.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (result?.canceled === true) return;
      
      const asset = result?.assets?.[0];
      const uri = asset?.uri || result?.uri;

      if (!uri) {
        Alert.alert('No image selected');
        return;
      }

      setImage(uri);
      dispatch(clearReceiptResult());
      setShowEditForm(false);
      
      // Convert to base64 for saving - try from result first, then fallback to FileSystem
      try {
        let base64Data = asset?.base64;
        if (!base64Data) {
          base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        }
        setImageBase64(`data:image/jpeg;base64,${base64Data}`);
      } catch (base64Error) {
        console.warn('Could not convert to base64:', base64Error);
        // Still allow scanning without base64 - image will be sent as form data
        setImageBase64(null);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to use camera is needed.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (result?.canceled === true) return;
      
      const asset = result?.assets?.[0];
      const uri = asset?.uri || result?.uri;

      if (!uri) {
        Alert.alert('No image selected');
        return;
      }

      setImage(uri);
      dispatch(clearReceiptResult());
      setShowEditForm(false);
      
      // Convert to base64 for saving - try from result first, then fallback to FileSystem
      try {
        let base64Data = asset?.base64;
        if (!base64Data) {
          base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        }
        setImageBase64(`data:image/jpeg;base64,${base64Data}`);
      } catch (base64Error) {
        console.warn('Could not convert to base64:', base64Error);
        // Still allow scanning without base64 - image will be sent as form data
        setImageBase64(null);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo: ' + error.message);
    }
  };

  const handleScanReceipt = async () => {
    if (!image) {
      Alert.alert('No image', 'Please select or take a photo first');
      return;
    }
    
    if (!token) {
      Alert.alert('Not authenticated', 'Please login');
      return;
    }

    const imageFormData = createImageFormData(image);
    dispatch(scanReceipt({ token, BACKEND, imageFormData }));
  };

  const handleSaveReceipt = async () => {
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid total amount');
      return;
    }

    const receiptData = {
      vendorName,
      receiptDate: receiptDate || new Date().toISOString(),
      totalAmount: parseFloat(totalAmount),
      items,
      category: selectedCategory,
      tricycleId: selectedTricycle,
      notes,
      rawOcrText: receiptResult?.lines?.map(l => l.text).join('\n') || '',
      ocrLines: receiptResult?.lines || [],
      ocrEngine: receiptResult?.meta?.engine || 'paddleocr',
      imageBase64
    };

    try {
      await dispatch(saveReceipt({ token, BACKEND, receiptData })).unwrap();
      Alert.alert('Success', 'Receipt saved successfully!', [
        { text: 'OK', onPress: resetForm }
      ]);
    } catch (error) {
      Alert.alert('Error', error || 'Failed to save receipt');
    }
  };

  const handleDeleteReceipt = (receiptId) => {
    Alert.alert(
      'Delete Receipt',
      'Are you sure you want to delete this receipt?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteReceipt({ token, BACKEND, receiptId })).unwrap();
              setShowReceiptModal(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete receipt');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setImage(null);
    setImageBase64(null);
    setVendorName('');
    setTotalAmount('');
    setReceiptDate('');
    setSelectedCategory('other');
    setSelectedTricycle(null);
    setNotes('');
    setItems([]);
    setShowEditForm(false);
    dispatch(clearReceiptResult());
  };

  // Category badge component
  const CategoryBadge = ({ categoryId, small = false }) => {
    const cat = CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[6];
    return (
      <View style={[
        receiptStyles.categoryBadge, 
        { backgroundColor: cat.color + '20' },
        small && { paddingHorizontal: 6, paddingVertical: 2 }
      ]}>
        <MaterialCommunityIcons name={cat.icon} size={small ? 12 : 14} color={cat.color} />
        <Text style={[receiptStyles.categoryBadgeText, { color: cat.color }, small && { fontSize: 10 }]}>
          {cat.label}
        </Text>
      </View>
    );
  };

  // Render receipt history item
  const renderReceiptItem = ({ item }) => (
    <TouchableOpacity 
      style={receiptStyles.historyItem}
      onPress={() => {
        setSelectedReceipt(item);
        setShowReceiptModal(true);
      }}
    >
      <View style={receiptStyles.historyItemLeft}>
        <View style={[receiptStyles.categoryIcon, { backgroundColor: (CATEGORIES.find(c => c.id === item.category)?.color || '#95a5a6') + '20' }]}>
          <MaterialCommunityIcons 
            name={CATEGORIES.find(c => c.id === item.category)?.icon || 'receipt'} 
            size={20} 
            color={CATEGORIES.find(c => c.id === item.category)?.color || '#95a5a6'} 
          />
        </View>
        <View style={receiptStyles.historyItemInfo}>
          <Text style={receiptStyles.historyVendor} numberOfLines={1}>
            {item.vendorName || 'Unknown Vendor'}
          </Text>
          <Text style={receiptStyles.historyDate}>
            {getRelativeTime(item.scanDate)}
          </Text>
        </View>
      </View>
      <View style={receiptStyles.historyItemRight}>
        <Text style={receiptStyles.historyAmount}>{formatCurrency(item.totalAmount)}</Text>
        <CategoryBadge categoryId={item.category} small />
      </View>
    </TouchableOpacity>
  );

  // Render scan view
  const renderScanView = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={receiptStyles.scanSection}>
        {/* Image preview */}
        <View style={receiptStyles.imageContainer}>
          {image ? (
            <Image source={{ uri: image }} style={receiptStyles.previewImage} resizeMode="cover" />
          ) : (
            <View style={receiptStyles.imagePlaceholder}>
              <Ionicons name="receipt-outline" size={48} color={colors.orangeShade5} />
              <Text style={receiptStyles.placeholderText}>No receipt image</Text>
              <Text style={receiptStyles.placeholderSubtext}>Take a photo or pick from gallery</Text>
            </View>
          )}
        </View>

        {/* Image buttons */}
        <View style={receiptStyles.buttonRow}>
          <TouchableOpacity style={[receiptStyles.actionBtn, { backgroundColor: colors.primary }]} onPress={pickImage}>
            <Ionicons name="images" size={18} color="#fff" />
            <Text style={receiptStyles.actionBtnText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[receiptStyles.actionBtn, { backgroundColor: '#6c757d' }]} onPress={takePhoto}>
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={receiptStyles.actionBtnText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Scan button */}
        <TouchableOpacity 
          style={[receiptStyles.scanBtn, (!image || loadingReceipt) && { opacity: 0.6 }]} 
          onPress={handleScanReceipt} 
          disabled={loadingReceipt || !image}
        >
          {loadingReceipt ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="text-recognition" size={20} color="#fff" />
              <Text style={receiptStyles.scanBtnText}>Scan Receipt</Text>
            </>
          )}
        </TouchableOpacity>

        {errorReceipt && (
          <View style={receiptStyles.errorBox}>
            <Ionicons name="warning" size={16} color="#e74c3c" />
            <Text style={receiptStyles.errorText}>{errorReceipt}</Text>
          </View>
        )}
      </View>

      {/* Editable form after scan */}
      {showEditForm && (
        <View style={receiptStyles.formSection}>
          <View style={receiptStyles.formHeader}>
            <Text style={receiptStyles.formTitle}>Receipt Details</Text>
            <Text style={receiptStyles.formSubtitle}>Review and edit extracted data</Text>
          </View>

          {/* Vendor Name */}
          <View style={receiptStyles.formGroup}>
            <Text style={receiptStyles.label}>Vendor/Store Name</Text>
            <TextInput
              style={receiptStyles.input}
              value={vendorName}
              onChangeText={setVendorName}
              placeholder="Enter vendor name"
              placeholderTextColor="#999"
            />
          </View>

          {/* Total Amount */}
          <View style={receiptStyles.formGroup}>
            <Text style={receiptStyles.label}>Total Amount (₱)</Text>
            <TextInput
              style={[receiptStyles.input, receiptStyles.amountInput]}
              value={totalAmount}
              onChangeText={setTotalAmount}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Date */}
          <View style={receiptStyles.formGroup}>
            <Text style={receiptStyles.label}>Receipt Date</Text>
            <TextInput
              style={receiptStyles.input}
              value={receiptDate}
              onChangeText={setReceiptDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
          </View>

          {/* Category Selection */}
          <View style={receiptStyles.formGroup}>
            <Text style={receiptStyles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={receiptStyles.categoryScroll}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    receiptStyles.categoryChip,
                    selectedCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <MaterialCommunityIcons 
                    name={cat.icon} 
                    size={16} 
                    color={selectedCategory === cat.id ? '#fff' : cat.color} 
                  />
                  <Text style={[
                    receiptStyles.categoryChipText,
                    selectedCategory === cat.id && { color: '#fff' }
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Link to Tricycle */}
          {tricycles.length > 0 && (
            <View style={receiptStyles.formGroup}>
              <Text style={receiptStyles.label}>Link to Tricycle (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[
                    receiptStyles.tricycleChip,
                    !selectedTricycle && receiptStyles.tricycleChipSelected
                  ]}
                  onPress={() => setSelectedTricycle(null)}
                >
                  <Text style={[receiptStyles.tricycleChipText, !selectedTricycle && { color: '#fff' }]}>
                    None
                  </Text>
                </TouchableOpacity>
                {tricycles.map(tri => (
                  <TouchableOpacity
                    key={tri._id}
                    style={[
                      receiptStyles.tricycleChip,
                      selectedTricycle === tri._id && receiptStyles.tricycleChipSelected
                    ]}
                    onPress={() => setSelectedTricycle(tri._id)}
                  >
                    <Text style={[
                      receiptStyles.tricycleChipText, 
                      selectedTricycle === tri._id && { color: '#fff' }
                    ]}>
                      {tri.plateNumber}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Notes */}
          <View style={receiptStyles.formGroup}>
            <Text style={receiptStyles.label}>Notes (Optional)</Text>
            <TextInput
              style={[receiptStyles.input, receiptStyles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes..."
              placeholderTextColor="#999"
              multiline
            />
          </View>

          {/* Extracted Items */}
          {items.length > 0 && (
            <View style={receiptStyles.formGroup}>
              <Text style={receiptStyles.label}>Detected Items</Text>
              <View style={receiptStyles.itemsList}>
                {items.map((item, idx) => (
                  <View key={idx} style={receiptStyles.itemRow}>
                    <Text style={receiptStyles.itemDesc} numberOfLines={1}>{item.description}</Text>
                    <Text style={receiptStyles.itemAmount}>{formatCurrency(item.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Save/Cancel buttons */}
          <View style={receiptStyles.formActions}>
            <TouchableOpacity style={receiptStyles.cancelBtn} onPress={resetForm}>
              <Text style={receiptStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[receiptStyles.saveBtn, savingReceipt && { opacity: 0.6 }]} 
              onPress={handleSaveReceipt}
              disabled={savingReceipt}
            >
              {savingReceipt ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={receiptStyles.saveBtnText}>Save Receipt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Raw OCR output (collapsible) */}
      {receiptResult && (
        <View style={receiptStyles.rawSection}>
          <Text style={receiptStyles.rawTitle}>Raw OCR Output</Text>
          <ScrollView style={receiptStyles.rawScroll} nestedScrollEnabled>
            {receiptResult.lines?.map((line, idx) => (
              <Text key={idx} style={receiptStyles.rawLine}>
                {line.text || line.raw || JSON.stringify(line)}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );

  // Render history view
  const renderHistoryView = () => (
    <View style={{ flex: 1 }}>
      {/* Category filter chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={receiptStyles.filterScroll}
        contentContainerStyle={receiptStyles.filterContent}
      >
        <TouchableOpacity
          style={[receiptStyles.filterChip, historyFilter === 'all' && receiptStyles.filterChipActive]}
          onPress={() => setHistoryFilter('all')}
        >
          <Text style={[receiptStyles.filterChipText, historyFilter === 'all' && { color: '#fff' }]}>
            All
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              receiptStyles.filterChip, 
              historyFilter === cat.id && { backgroundColor: cat.color }
            ]}
            onPress={() => setHistoryFilter(cat.id)}
          >
            <MaterialCommunityIcons 
              name={cat.icon} 
              size={14} 
              color={historyFilter === cat.id ? '#fff' : cat.color} 
            />
            <Text style={[
              receiptStyles.filterChipText, 
              historyFilter === cat.id && { color: '#fff' }
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Summary cards */}
      <View style={receiptStyles.summaryRow}>
        <View style={receiptStyles.summaryCard}>
          <Text style={receiptStyles.summaryLabel}>Total Receipts</Text>
          <Text style={receiptStyles.summaryValue}>{receipts.length}</Text>
        </View>
        <View style={receiptStyles.summaryCard}>
          <Text style={receiptStyles.summaryLabel}>Total Spent</Text>
          <Text style={[receiptStyles.summaryValue, { color: colors.primary }]}>
            {formatCurrency(receipts.reduce((sum, r) => sum + (r.totalAmount || 0), 0))}
          </Text>
        </View>
      </View>

      {/* Receipts list */}
      {loadingReceipts && receipts.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : receipts.length === 0 ? (
        <View style={receiptStyles.emptyState}>
          <MaterialCommunityIcons name="receipt-text-outline" size={64} color="#ccc" />
          <Text style={receiptStyles.emptyText}>No receipts yet</Text>
          <Text style={receiptStyles.emptySubtext}>Scan your first receipt to get started</Text>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={item => item._id}
          renderItem={renderReceiptItem}
          contentContainerStyle={receiptStyles.historyList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  // Receipt detail modal
  const renderReceiptModal = () => (
    <Modal
      visible={showReceiptModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowReceiptModal(false)}
    >
      <View style={receiptStyles.modalOverlay}>
        <View style={receiptStyles.modalContent}>
          <View style={receiptStyles.modalHeader}>
            <Text style={receiptStyles.modalTitle}>Receipt Details</Text>
            <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {selectedReceipt && (
            <ScrollView style={receiptStyles.modalBody}>
              {/* Receipt image */}
              {selectedReceipt.imageUrl && (
                <Image 
                  source={{ uri: selectedReceipt.imageUrl }} 
                  style={receiptStyles.modalImage}
                  resizeMode="contain"
                />
              )}

              {/* Details */}
              <View style={receiptStyles.modalDetail}>
                <Text style={receiptStyles.modalDetailLabel}>Vendor</Text>
                <Text style={receiptStyles.modalDetailValue}>
                  {selectedReceipt.vendorName || 'Unknown'}
                </Text>
              </View>

              <View style={receiptStyles.modalDetail}>
                <Text style={receiptStyles.modalDetailLabel}>Amount</Text>
                <Text style={[receiptStyles.modalDetailValue, { fontSize: 24, color: colors.primary }]}>
                  {formatCurrency(selectedReceipt.totalAmount)}
                </Text>
              </View>

              <View style={receiptStyles.modalDetail}>
                <Text style={receiptStyles.modalDetailLabel}>Category</Text>
                <CategoryBadge categoryId={selectedReceipt.category} />
              </View>

              <View style={receiptStyles.modalDetail}>
                <Text style={receiptStyles.modalDetailLabel}>Date</Text>
                <Text style={receiptStyles.modalDetailValue}>
                  {formatDate(selectedReceipt.receiptDate)}
                </Text>
              </View>

              {selectedReceipt.tricycle && (
                <View style={receiptStyles.modalDetail}>
                  <Text style={receiptStyles.modalDetailLabel}>Tricycle</Text>
                  <Text style={receiptStyles.modalDetailValue}>
                    {selectedReceipt.tricycle.plateNumber}
                  </Text>
                </View>
              )}

              {selectedReceipt.notes && (
                <View style={receiptStyles.modalDetail}>
                  <Text style={receiptStyles.modalDetailLabel}>Notes</Text>
                  <Text style={receiptStyles.modalDetailValue}>{selectedReceipt.notes}</Text>
                </View>
              )}

              <View style={receiptStyles.modalDetail}>
                <Text style={receiptStyles.modalDetailLabel}>Scanned</Text>
                <Text style={receiptStyles.modalDetailValue}>
                  {formatDate(selectedReceipt.scanDate)}
                </Text>
              </View>

              {/* Delete button */}
              <TouchableOpacity 
                style={receiptStyles.deleteBtn}
                onPress={() => handleDeleteReceipt(selectedReceipt._id)}
              >
                <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                <Text style={receiptStyles.deleteBtnText}>Delete Receipt</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { padding: 0 }]}>
      {/* Tab switcher */}
      <View style={receiptStyles.tabBar}>
        <TouchableOpacity 
          style={[receiptStyles.tab, activeView === 'scan' && receiptStyles.tabActive]}
          onPress={() => setActiveView('scan')}
        >
          <Ionicons name="scan" size={18} color={activeView === 'scan' ? colors.primary : '#666'} />
          <Text style={[receiptStyles.tabText, activeView === 'scan' && { color: colors.primary }]}>
            Scan Receipt
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[receiptStyles.tab, activeView === 'history' && receiptStyles.tabActive]}
          onPress={() => setActiveView('history')}
        >
          <Ionicons name="time" size={18} color={activeView === 'history' ? colors.primary : '#666'} />
          <Text style={[receiptStyles.tabText, activeView === 'history' && { color: colors.primary }]}>
            History
          </Text>
          {receipts.length > 0 && (
            <View style={receiptStyles.badge}>
              <Text style={receiptStyles.badgeText}>{receipts.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1, padding: spacing.medium }}>
        {activeView === 'scan' ? renderScanView() : renderHistoryView()}
      </View>

      {renderReceiptModal()}
    </SafeAreaView>
  );
}

const receiptStyles = {
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Scan section
  scanSection: {
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f8f8',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  placeholderText: {
    color: colors.orangeShade5,
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderSubtext: {
    color: '#999',
    marginTop: 4,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d6efd',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  scanBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 13,
  },

  // Form section
  formSection: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formHeader: {
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  formSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#eee',
  },
  amountInput: {
    fontSize: 20,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryScroll: {
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    gap: 4,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  tricycleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    backgroundColor: '#f5f5f5',
  },
  tricycleChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tricycleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  itemsList: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemDesc: {
    flex: 1,
    fontSize: 13,
    color: '#555',
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#666',
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#28a745',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
  },

  // Raw OCR section
  rawSection: {
    marginTop: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  rawTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  rawScroll: {
    maxHeight: 150,
  },
  rawLine: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    fontFamily: 'monospace',
  },

  // History view
  filterScroll: {
    maxHeight: 44,
    marginBottom: 12,
  },
  filterContent: {
    paddingRight: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  historyList: {
    paddingBottom: 20,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyItemInfo: {
    flex: 1,
  },
  historyVendor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  historyDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  historyItemRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
  },
  modalDetail: {
    marginBottom: 16,
  },
  modalDetailLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  modalDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e74c3c',
    marginTop: 16,
    marginBottom: 30,
    gap: 8,
  },
  deleteBtnText: {
    color: '#e74c3c',
    fontWeight: '600',
  },
};