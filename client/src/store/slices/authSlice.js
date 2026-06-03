import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ── Thunks ─────────────────────────────────────────────────────────────────────
export const sendOTP = createAsyncThunk('auth/sendOTP', async ({ phone, role }, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/send-otp', { phone, role });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to send OTP');
  }
});

export const verifyOTP = createAsyncThunk('auth/verifyOTP', async (payload, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/verify-otp', payload);
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'OTP verification failed');
  }
});

export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch {}
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
});

export const activatePlusMembership = createAsyncThunk('auth/activatePlus', async (_, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/plus');
    const { user } = res.data;
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to activate Plus membership');
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })(),
    accessToken: localStorage.getItem('accessToken'),
    otpSent: false,
    otpPhone: null,
    loading: false,
    error: null,
  },
  reducers: {
    setUser(state, action) { state.user = action.payload; },
    clearError(state) { state.error = null; },
    resetOtp(state) { state.otpSent = false; state.otpPhone = null; },
    updateUser(state, action) { state.user = { ...state.user, ...action.payload }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendOTP.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(sendOTP.fulfilled, (state, action) => {
        state.loading = false;
        state.otpSent = true;
        state.otpPhone = action.meta.arg.phone;
      })
      .addCase(sendOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload);
      })
      .addCase(verifyOTP.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.otpSent = false;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload);
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.otpSent = false;
      })
      .addCase(activatePlusMembership.pending, (state) => {
        state.loading = true;
      })
      .addCase(activatePlusMembership.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        toast.success(action.payload.isPlusMember ? 'Welcome to ServiceHub Plus!' : 'Plus membership updated');
      })
      .addCase(activatePlusMembership.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload);
      });
  },
});

export const { setUser, clearError, resetOtp, updateUser } = authSlice.actions;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => !!state.auth.user;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectUserRole = (state) => state.auth.user?.role;
export default authSlice.reducer;
