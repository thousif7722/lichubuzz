// ── bookingSlice.js ────────────────────────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';
import toast from 'react-hot-toast';

export const fetchMyBookings = createAsyncThunk('booking/fetchMine', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/bookings', { params });
    return res.data;
  } catch (err) { return rejectWithValue(err.response?.data?.error); }
});

export const fetchBookingById = createAsyncThunk('booking/fetchById', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/bookings/${id}`);
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.error); }
});

export const createBooking = createAsyncThunk('booking/create', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/bookings', data);
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.error); }
});

const bookingSlice = createSlice({
  name: 'booking',
  initialState: {
    bookings: [], currentBooking: null, activeBooking: null,
    loading: false, error: null, pagination: null,
  },
  reducers: {
    setActiveBooking(state, action) { state.activeBooking = action.payload; },
    updateBookingStatus(state, action) {
      const { bookingId, status, endOtp } = action.payload;
      if (state.currentBooking?._id === bookingId) {
        state.currentBooking.status = status;
        if (endOtp) state.currentBooking.endOtp = endOtp;
      }
      const booking = state.bookings.find(b => b._id === bookingId);
      if (booking) booking.status = status;
    },
    clearCurrentBooking(state) { state.currentBooking = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyBookings.pending, (state) => { state.loading = true; })
      .addCase(fetchMyBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchMyBookings.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchBookingById.pending, (state) => { state.loading = true; })
      .addCase(fetchBookingById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentBooking = action.payload.booking;
      })
      .addCase(fetchBookingById.rejected, (state) => { state.loading = false; })
      .addCase(createBooking.pending, (state) => { state.loading = true; })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.activeBooking = action.payload;
        toast.success('Booking created! Finding the best provider for you...');
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload || 'Failed to create booking');
      });
  },
});

export const { setActiveBooking, updateBookingStatus, clearCurrentBooking } = bookingSlice.actions;
export const selectBookings = (state) => state.booking.bookings;
export const selectCurrentBooking = (state) => state.booking.currentBooking;
export const selectActiveBooking = (state) => state.booking.activeBooking;
export const selectBookingLoading = (state) => state.booking.loading;
export default bookingSlice.reducer;
