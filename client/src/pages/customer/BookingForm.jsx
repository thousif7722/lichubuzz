import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Calendar, Clock, MapPin, Tag, ChevronLeft, Loader,
  Navigation, PenLine, CheckCircle2, RefreshCw, Plus, Minus,
} from 'lucide-react';
import { createBooking, selectBookingLoading } from '@/store/slices/bookingSlice';
import { selectUser } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const TIME_SLOTS = [
  '07:00–09:00', '09:00–11:00', '11:00–13:00',
  '13:00–15:00', '15:00–17:00', '17:00–19:00',
];

const schema = yup.object({
  scheduledDate: yup.string().required('Date required'),
  timeSlot: yup.string().required('Please select a time slot'),
  line1: yup.string().required('Address required'),
  city: yup.string().required('City required'),
  state: yup.string().required('State required'),
  pincode: yup.string().matches(/^\d{6}$/, '6-digit pincode required').required(),
  couponCode: yup.string().optional(),
  notes: yup.string().max(300).optional(),
});

// ── Reverse-geocoding via OpenStreetMap Nominatim (no API key) ─────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.address || {};
    return {
      line1: [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(', ') || '',
      city: addr.city || addr.town || addr.village || addr.county || '',
      state: addr.state || '',
      pincode: addr.postcode || '',
    };
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// LOCATION PICKER COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function LocationPicker({ onLocationSet, savedAddress }) {
  const [gpsCoords, setGpsCoords] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Manual fields (initially empty or from savedAddress, then populated by GPS)
  const [manual, setManual] = useState({
    line1: savedAddress?.line1 || '',
    city: savedAddress?.city || '',
    state: savedAddress?.state || '',
    pincode: savedAddress?.pincode || '',
  });

  const detectGPS = useCallback((isAuto = false) => {
    if (!navigator.geolocation) {
      if (!isAuto) toast.error('Geolocation is not supported by your browser');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        setGpsCoords([lng, lat]); // [lng, lat] for MongoDB
        if (!isAuto) toast.loading('Locating service area…', { id: 'geocode' });
        const addr = await reverseGeocode(lat, lng);
        if (!isAuto) toast.dismiss('geocode');

        if (addr) {
          setManual({
            line1: addr.line1 || '',
            city: addr.city || '',
            state: addr.state || '',
            pincode: addr.pincode || '',
          });
          if (!isAuto) toast.success('Location detected!');
        } else {
          if (!isAuto) toast.success(`GPS locked!`);
        }
        setDetecting(false);
        setConfirmed(false);
      },
      (err) => {
        setDetecting(false);
        if (!isAuto) {
          if (err.code === 1) toast.error('Check location permissions in your browser.');
          else toast.error('GPS unavailable. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!gpsCoords) {
      detectGPS(true);
    }
  }, [detectGPS, gpsCoords]);

  function handleConfirm() {
    if (!gpsCoords) {
      toast.error('Please detect your location first');
      return;
    }
    if (!manual.line1 || !manual.city) {
      toast.error('Address details missing. Please try redetecting.');
      return;
    }
    setConfirmed(true);
    onLocationSet({
      coords: gpsCoords, 
      address: manual,
    });
    toast.success('Location confirmed!');
  }

  return (
    <div className="card p-5 space-y-4 border-2 border-primary-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
            <MapPin className="text-primary-600" size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Service Location</h3>
            <p className="text-xs text-slate-400">Direct GPS detection</p>
          </div>
        </div>
        {confirmed && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            <CheckCircle2 size={13} /> Verified
          </span>
        )}
      </div>

      <div className="space-y-3 pt-1">
        {/* Detection UI */}
        {!gpsCoords && !detecting && (
          <button
            type="button"
            onClick={() => detectGPS()}
            className="w-full py-6 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/30 flex flex-col items-center justify-center gap-2 text-primary-600 hover:bg-primary-50 transition-all"
          >
            <Navigation className="animate-pulse" size={24} />
            <span className="text-sm font-bold">Detect My Location</span>
          </button>
        )}

        {detecting && (
          <div className="w-full py-6 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/30 flex flex-col items-center justify-center gap-2 text-primary-600">
            <Loader className="animate-spin" size={24} />
            <span className="text-sm font-bold animate-pulse">Finding your GPS location…</span>
          </div>
        )}

        {gpsCoords && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
               <div className="flex items-start gap-2">
                 <MapPin size={14} className="text-primary-500 mt-0.5 shrink-0" />
                 <div>
                   <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detected address</p>
                   <p className="text-sm text-slate-600 font-medium mt-1">
                     {manual.line1 ? `${manual.line1}, ` : ''}{manual.city}, {manual.state} {manual.pincode}
                   </p>
                 </div>
               </div>
               <button 
                type="button"
                onClick={() => detectGPS()}
                className="text-[10px] font-bold text-primary-600 hover:underline uppercase tracking-tighter"
               >
                 Not correct? Redetect GPS
               </button>
            </div>

            {/* Optional field for flat/house info */}
            <div className="relative">
              <input
                value={manual.line1}
                onChange={e => { setManual(m => ({ ...m, line1: e.target.value })); setConfirmed(false); }}
                placeholder="Add Flat / House No / Landmark (Optional)"
                className="input-field pr-10 text-sm"
              />
              <PenLine size={14} className="absolute right-3 top-3.5 text-slate-400" />
            </div>

            {!confirmed ? (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={detecting}
                className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Confirm Location
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-3.5 rounded-2xl border border-emerald-100 text-sm font-bold animate-in fade-in zoom-in duration-300">
                <CheckCircle2 size={18} /> GPS Location Confirmed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING FORM PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function BookingForm() {
  const { serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const loading = useSelector(selectBookingLoading);
  const user = useSelector(selectUser);

  const [service, setService] = useState(null);
  const [couponApplied, setCouponApplied] = useState(null);
  const [locationData, setLocationData] = useState(null);
  // Quantity — initialized from ?qty= URL param (from CategoryServicesPage)
  const [quantity, setQuantity] = useState(() => Math.max(1, Math.min(10, parseInt(searchParams.get('qty') || '1', 10))));

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      scheduledDate: dayjs().format('YYYY-MM-DD'),
      city: user?.addresses?.[0]?.city || '',
      state: user?.addresses?.[0]?.state || '',
      pincode: user?.addresses?.[0]?.pincode || '',
      line1: user?.addresses?.[0]?.line1 || '',
    },
  });

  const selectedSlot = watch('timeSlot');

  useEffect(() => {
    apiService.getServiceById(serviceId)
      .then(res => setService(res.data.data))
      .catch(() => { toast.error('Service not found'); navigate('/'); });
  }, [serviceId]);

  // When location is confirmed by the picker, populate the form fields
  const handleLocationSet = useCallback((data) => {
    setLocationData(data);
    if (data.address?.line1) setValue('line1', data.address.line1);
    if (data.address?.city) setValue('city', data.address.city);
    if (data.address?.state) setValue('state', data.address.state);
    if (data.address?.pincode) setValue('pincode', data.address.pincode);
  }, [setValue]);

  async function onSubmit(data) {
    try {
      // Use GPS coords if available, else default to Hyderabad as fallback
      const coords = locationData?.coords || [78.4867, 17.3850];

      const rawSlot = data.timeSlot || '';
      const parts = rawSlot.split(/[–\-—]/);
      const slotFrom = (parts[0] || '09:00').trim();
      const slotTo   = (parts[1] || '11:00').trim();

      const dateStr = data.scheduledDate || dayjs().add(1, 'day').format('YYYY-MM-DD');
      const scheduledDate = new Date(`${dateStr}T23:59:00`);

      const bookingData = {
        serviceId,
        scheduledDate: scheduledDate.toISOString(),
        timeSlot: { from: slotFrom, to: slotTo },
        serviceAddress: {
          line1: data.line1,
          city: data.city,
          state: data.state,
          pincode: String(data.pincode),
          location: { coordinates: coords },
        },
        customerNotes: data.notes?.trim() || undefined,
        couponCode: couponApplied?.code || undefined,
      };

      const result = await dispatch(createBooking(bookingData));
      if (result?.payload?.bookingId) {
        toast.success('Booking confirmed! Finding a provider near you…');
        navigate(`/bookings/${result.payload.bookingId}`);
      } else if (result.error) {
        toast.error(result.payload || 'Booking failed. Please try again.');
      }
    } catch (err) {
      console.error('Booking submit error:', err);
      toast.error('Unexpected error. Please try again.');
    }
  }

  const onError = (errs) => {
    const firstError = Object.values(errs)[0];
    if (firstError) toast.error(firstError.message);
  };

  const plusDiscount = user?.isPlusMember ? Math.round((service?.basePrice || 0) * quantity * 0.1) : 0;
  const baseTotal = service ? (service.basePrice * quantity) - plusDiscount - (couponApplied?.discountAmount || 0) : 0;
  const savedAddress = user?.addresses?.[0];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-6 text-sm font-medium">
          <ChevronLeft size={16} /> Back
        </button>

        {service && (
          <div className="card p-4 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-primary-50 rounded-xl text-3xl flex items-center justify-center shrink-0">{service.icon || '🔧'}</div>
              <div className="flex-1">
                <h2 className="font-bold text-slate-900">{service.name}</h2>
                <p className="text-sm text-slate-500">{service.duration} min · ₹{service.basePrice} per unit</p>
              </div>
            </div>
            {/* Quantity selector */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Number of Units</p>
                <p className="text-xs text-slate-400">e.g., 2 ACs, 3 rooms</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                >
                  <Minus size={15} />
                </button>
                <span className="w-8 text-center font-bold text-lg text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(10, q + 1))}
                  className="w-9 h-9 rounded-xl bg-primary-600 shadow-sm flex items-center justify-center text-white hover:bg-primary-700 active:scale-95 transition-all"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-5">
          {/* Date */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-primary-600" size={18} />
              <h3 className="font-semibold text-slate-800">Select Date</h3>
            </div>
            <input
              type="date"
              {...register('scheduledDate')}
              min={dayjs().format('YYYY-MM-DD')}
              max={dayjs().add(30, 'day').format('YYYY-MM-DD')}
              className="input-field"
            />
            {errors.scheduledDate && <p className="text-red-500 text-xs mt-1">{errors.scheduledDate.message}</p>}
          </div>

          {/* Time Slots */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-primary-600" size={18} />
              <h3 className="font-semibold text-slate-800">Select Time Slot</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setValue('timeSlot', slot)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    selectedSlot === slot
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-primary-300 bg-white'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
            {errors.timeSlot && <p className="text-red-500 text-xs mt-2">{errors.timeSlot.message}</p>}
          </div>

          {/* Location Picker — GPS or Manual */}
          <LocationPicker onLocationSet={handleLocationSet} savedAddress={savedAddress} />

          {/* Validation errors for address info */}
          {(errors.line1 || errors.city || errors.state || errors.pincode) && (
            <div className="px-5 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
              Please confirm your full address details above.
            </div>
          )}

          {/* Coupon */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="text-primary-600" size={18} />
              <h3 className="font-semibold text-slate-800">Coupon Code</h3>
            </div>
            <CouponInput
              serviceBasePrice={service?.basePrice || 0}
              onApply={setCouponApplied}
              applied={couponApplied}
            />
          </div>

          {/* Notes */}
          <div className="card p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Special Instructions (optional)</label>
            <textarea {...register('notes')} rows={3} placeholder="Any special instructions for the service provider…" className="input-field resize-none" />
          </div>

          {/* Bill summary */}
          {service && (
            <div className="card p-5 bg-primary-50 border-primary-100">
              <h3 className="font-semibold text-slate-800 mb-3">Estimated Bill</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Base price</span>
                  <span>₹{service.basePrice}</span>
                </div>
                {quantity > 1 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Units × {quantity}</span>
                    <span>₹{service.basePrice * quantity}</span>
                  </div>
                )}
                {user?.isPlusMember && (
                  <div className="flex justify-between text-yellow-600 bg-yellow-50 px-2 py-1 -mx-2 rounded-lg items-center">
                    <span className="font-semibold flex items-center gap-1">★ Plus Discount (10%)</span>
                    <span className="font-bold">-₹{plusDiscount}</span>
                  </div>
                )}
                {couponApplied && (
                  <div className="flex justify-between text-emerald-600 px-2 py-1 -mx-2 bg-emerald-50 rounded-lg items-center">
                    <span className="font-semibold">Discount ({couponApplied.code})</span>
                    <span className="font-bold">-₹{couponApplied.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Material charges (if any)</span>
                  <span>After completion</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-primary-200">
                  <span>Estimated Total</span>
                  <span className="text-primary-700">₹{baseTotal}+</span>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !service}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
          >
            {loading ? <><Loader size={18} className="animate-spin" /> Creating booking…</> : '✅ Confirm Booking'}
          </button>
        </form>
      </div>
    </div>
  );
}

function CouponInput({ serviceBasePrice, onApply, applied }) {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);

  async function handleApply() {
    if (!code.trim()) return;
    setValidating(true);
    try {
      toast.success(`Coupon applied! (validation on booking submit)`);
      onApply({ code: code.toUpperCase(), discountAmount: 50 });
    } catch {
      toast.error('Invalid or expired coupon');
    } finally {
      setValidating(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <div>
          <p className="font-semibold text-green-700 text-sm">{applied.code} applied ✅</p>
          <p className="text-xs text-green-600">Saving ₹{applied.discountAmount}</p>
        </div>
        <button onClick={() => onApply(null)} className="text-red-500 text-xs font-medium hover:underline">Remove</button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder="Enter coupon code"
        className="input-field flex-1"
      />
      <button
        type="button"
        onClick={handleApply}
        disabled={validating || !code.trim()}
        className="btn-secondary px-5 whitespace-nowrap"
      >
        {validating ? '…' : 'Apply'}
      </button>
    </div>
  );
}
