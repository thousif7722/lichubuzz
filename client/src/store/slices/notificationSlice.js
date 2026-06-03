import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

export const fetchNotifications = createAsyncThunk('notification/fetchAll', async () => {
  const res = await api.get('/notifications');
  return res.data;
});

export const markAllRead = createAsyncThunk('notification/markAllRead', async () => {
  await api.put('/notifications/read-all');
});

const notificationSlice = createSlice({
  name: 'notification',
  initialState: { notifications: [], unreadCount: 0, loading: false },
  reducers: {
    addNotification(state, action) {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
    decrementUnread(state) {
      if (state.unreadCount > 0) state.unreadCount -= 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications = action.payload.data;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(markAllRead.fulfilled, (state) => {
        state.unreadCount = 0;
        state.notifications = state.notifications.map(n => ({ ...n, isRead: true }));
      });
  },
});

export const { addNotification, decrementUnread } = notificationSlice.actions;
export const selectNotifications = (state) => state.notification.notifications;
export const selectUnreadCount = (state) => state.notification.unreadCount;
export default notificationSlice.reducer;
