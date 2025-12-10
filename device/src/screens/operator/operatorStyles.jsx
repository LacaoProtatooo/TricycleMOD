import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../components/common/theme';

export default StyleSheet.create({
  // Main container
  container: { flex: 1, backgroundColor: colors.background },
  
  // Header
  header: { padding: spacing.medium, paddingBottom: 8 },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.orangeShade7 },
  subtitle: { color: colors.orangeShade5, marginTop: 4, fontSize: 12 },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Tricycle list item
  itemWrap: { marginBottom: spacing.small },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.medium,
  },
  info: { flex: 1 },
  plate: { fontWeight: '700', color: colors.orangeShade7, fontSize: 16 },
  driver: { color: colors.orangeShade5, marginTop: 4 },
  meta: { color: colors.orangeShade5, fontSize: 12, marginTop: 2 },
  right: { width: 24, alignItems: 'flex-end' },
  chev: { color: colors.orangeShade5 },
  
  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.medium,
    marginTop: 8,
    marginBottom: spacing.small,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  assignBtn: { backgroundColor: colors.primary },
  unassignBtn: { backgroundColor: '#dc3545' },
  messageBtn: { backgroundColor: '#6c757d' },
  actionBtnText: { color: '#fff', marginLeft: 6, fontWeight: '600', fontSize: 12 },
  
  // Driver list item
  driverItem: {
    flexDirection: 'row',
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
    marginBottom: spacing.small,
    alignItems: 'center',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ivory3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.medium,
  },
  driverAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  driverInfo: { flex: 1 },
  driverName: { fontWeight: '700', color: colors.orangeShade7 },
  driverUsername: { color: colors.orangeShade5, fontSize: 12, marginTop: 2 },
  driverRating: { color: colors.orangeShade5, fontSize: 12, marginTop: 4 },
  
  // Modal styles
  modalContainer: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: spacing.medium,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
    maxHeight: '80%',
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.orangeShade7, 
    marginBottom: 8 
  },
  modalSub: { 
    color: colors.orangeShade5, 
    marginBottom: 16, 
    fontSize: 14 
  },
  textInput: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.ivory3,
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.small,
  },
  modalActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: spacing.medium 
  },
  modalBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 8, 
    marginLeft: 8 
  },
  modalBtnText: { color: '#fff', fontWeight: '700' },
  
  // Driver list in modal
  driverList: {
    maxHeight: 300,
    marginBottom: spacing.medium,
  },
  driverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory3,
    borderRadius: 8,
    marginBottom: spacing.small,
  },
  driverOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ivory3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.medium,
  },
  driverOptionAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  driverOptionInfo: { flex: 1 },
  driverOptionName: { fontWeight: '600', color: colors.orangeShade7 },
  driverOptionUsername: { color: colors.orangeShade5, fontSize: 12, marginTop: 2 },
});