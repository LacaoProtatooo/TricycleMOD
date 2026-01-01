import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { colors, spacing } from '../../../components/common/theme';
import styles from '../operatorStyles';

const MOTORCYCLE_MODELS = [
  {
    brand: 'Honda',
    models: [
      'TMX 125 Alpha',
      'TMX 155',
      'TMX Supremo',
      'XRM 110 / 125',
      'Wave 110 / 125',
    ],
  },
  {
    brand: 'Yamaha',
    models: [
      'YTX 125',
      'YTX 125 DX',
      'SZ 150',
      'Sight',
      'Vega',
    ],
  },
  {
    brand: 'Suzuki',
    models: [
      'GD 110',
      'GD 115',
      'Raider J 115',
      'Smash 110 / 115',
    ],
  },
  {
    brand: 'Kawasaki',
    models: [
      'Barako II 175',
      'Barako 175',
      'CT 125',
    ],
  },
  {
    brand: 'Rusi',
    models: [
      'Rusi 125',
      'Rusi 150',
      'Rusi Classic 250',
    ],
  },
];

export default function AddTricycleModal({
  visible,
  onClose,
  onSubmit,
  newTricycle,
  setNewTricycle,
  creating
}) {
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [customModel, setCustomModel] = useState('');

  const handleModelSelect = (brand, model) => {
    setNewTricycle({ ...newTricycle, model: `${brand} ${model}` });
    setShowModelPicker(false);
  };

  const handleOtherModelSubmit = () => {
    if (customModel.trim()) {
      setNewTricycle({ ...newTricycle, model: customModel.trim() });
      setShowModelPicker(false);
      setShowOtherInput(false);
      setCustomModel('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          style={styles.modalContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <Text style={styles.modalTitle}>Add New Tricycle</Text>
              
              <TextInput
                style={styles.textInput}
                placeholder="Plate Number"
                value={newTricycle.plateNumber}
                onChangeText={(text) => setNewTricycle({ ...newTricycle, plateNumber: text.toUpperCase() })}
                editable={!creating}
              />

              <TextInput
                style={styles.textInput}
                placeholder="Body Number"
                value={newTricycle.bodyNumber}
                onChangeText={(text) => setNewTricycle({ ...newTricycle, bodyNumber: text.toUpperCase() })}
                editable={!creating}
              />
              
              {/* Model Dropdown */}
              <TouchableOpacity
                style={[styles.textInput, { justifyContent: 'center' }]}
                onPress={() => !creating && setShowModelPicker(true)}
                disabled={creating}
              >
                <Text style={{ color: newTricycle.model ? '#000' : '#999' }}>
                  {newTricycle.model || 'Select Model'}
                </Text>
              </TouchableOpacity>

              {/* Model Picker Modal */}
              <Modal visible={showModelPicker} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <KeyboardAvoidingView 
                    style={styles.modalContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                  >
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                      {!showOtherInput ? (
                        <>
                          <Text style={styles.modalTitle}>Select Motorcycle Model</Text>
                          <ScrollView 
                            style={{ width: '100%' }}
                            keyboardShouldPersistTaps="handled"
                          >
                            {MOTORCYCLE_MODELS.map((brandGroup) => (
                              <View key={brandGroup.brand} style={{ marginBottom: 15 }}>
                                <Text style={{
                                  fontSize: 16,
                                  fontWeight: 'bold',
                                  color: colors.primary,
                                  marginBottom: 8,
                                  paddingLeft: 5,
                                }}>
                                  {brandGroup.brand}
                                </Text>
                                {brandGroup.models.map((model) => (
                                  <TouchableOpacity
                                    key={model}
                                    style={{
                                      padding: 12,
                                      backgroundColor: '#f5f5f5',
                                      borderRadius: 8,
                                      marginBottom: 5,
                                    }}
                                    onPress={() => handleModelSelect(brandGroup.brand, model)}
                                  >
                                    <Text style={{ fontSize: 14, color: '#333' }}>{model}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            ))}
                            {/* Others Option */}
                            <View style={{ marginBottom: 15 }}>
                              <Text style={{
                                fontSize: 16,
                                fontWeight: 'bold',
                                color: colors.primary,
                                marginBottom: 8,
                                paddingLeft: 5,
                              }}>
                                Other
                              </Text>
                              <TouchableOpacity
                                style={{
                                  padding: 12,
                                  backgroundColor: '#f5f5f5',
                                  borderRadius: 8,
                                  marginBottom: 5,
                                }}
                                onPress={() => setShowOtherInput(true)}
                              >
                                <Text style={{ fontSize: 14, color: '#333' }}>Enter Custom Model</Text>
                              </TouchableOpacity>
                            </View>
                          </ScrollView>
                          <TouchableOpacity
                            style={[styles.modalBtn, { backgroundColor: '#6c757d', marginTop: 10, width: '100%' }]}
                            onPress={() => setShowModelPicker(false)}
                          >
                            <Text style={styles.modalBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <Text style={styles.modalTitle}>Enter Motorcycle Model</Text>
                          <TextInput
                            style={styles.textInput}
                            placeholder="e.g., Kawasaki Barako, Rusi Custom"
                            value={customModel}
                            onChangeText={setCustomModel}
                            editable={!creating}
                            autoFocus
                          />
                          <View style={styles.modalActions}>
                            <TouchableOpacity
                              style={[styles.modalBtn, { backgroundColor: '#6c757d' }]}
                              onPress={() => {
                                setShowOtherInput(false);
                                setCustomModel('');
                              }}
                            >
                              <Text style={styles.modalBtnText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                              onPress={handleOtherModelSubmit}
                              disabled={!customModel.trim() || creating}
                            >
                              <Text style={styles.modalBtnText}>Submit</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
              </Modal>
              
              <TextInput
                style={styles.textInput}
                placeholder="Initial Odometer (km)"
                value={newTricycle.currentOdometer}
                onChangeText={(text) => setNewTricycle({ ...newTricycle, currentOdometer: text })}
                keyboardType="numeric"
                editable={!creating}
              />
            </ScrollView>
            
            <View style={[styles.modalActions, { marginTop: 10 }]}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={onClose} 
                disabled={creating}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.primary }]} 
                onPress={onSubmit} 
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}