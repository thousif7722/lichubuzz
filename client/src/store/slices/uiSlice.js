import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { sidebarOpen: false, modalOpen: null },
  reducers: {
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen; },
    closeSidebar(state) { state.sidebarOpen = false; },
    openModal(state, action) { state.modalOpen = action.payload; },
    closeModal(state) { state.modalOpen = null; },
  },
});

export const { toggleSidebar, closeSidebar, openModal, closeModal } = uiSlice.actions;
export const selectModalOpen = (state) => state.ui.modalOpen;
export default uiSlice.reducer;
