// serviceSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

export const fetchServices = createAsyncThunk('service/fetchAll', async (params = {}) => {
  const res = await api.get('/services', { params });
  return res.data.data;
});

export const fetchCategories = createAsyncThunk('service/fetchCategories', async () => {
  const res = await api.get('/services/categories');
  return res.data.data;
});

const serviceSlice = createSlice({
  name: 'service',
  initialState: { services: [], categories: [], loading: false, selectedCategory: 'All', search: '' },
  reducers: {
    setSelectedCategory(state, action) { state.selectedCategory = action.payload; },
    setSearch(state, action) { state.search = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServices.pending, (state) => { state.loading = true; })
      .addCase(fetchServices.fulfilled, (state, action) => { state.loading = false; state.services = action.payload; })
      .addCase(fetchServices.rejected, (state) => { state.loading = false; })
      .addCase(fetchCategories.fulfilled, (state, action) => { state.categories = ['All', ...action.payload]; });
  },
});

export const { setSelectedCategory, setSearch } = serviceSlice.actions;
export const selectServices = (state) => state.service.services;
export const selectCategories = (state) => state.service.categories;
export const selectServiceLoading = (state) => state.service.loading;
export const selectSelectedCategory = (state) => state.service.selectedCategory;
export default serviceSlice.reducer;
