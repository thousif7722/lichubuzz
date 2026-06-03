import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Plus, Trash2, ChevronLeft, Package, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MaterialsBilling() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [step, setStep] = useState(1); // 1=materials, 2=work details, 3=complete

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      items: [{ name: '', quantity: 1, unit: 'pcs', unitPrice: '', brand: '' }],
      notes: '',
      workPerformed: '',
      extraCharges: 0,
      extraChargesNote: '',
      endOtp: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);

  useEffect(() => {
    apiService.getBooking(id).then(res => setBooking(res.data.data.booking));
  }, [id]);

  async function onSaveMaterials(data) {
    setSubmitting(true);
    try {
      const validItems = data.items.filter(item => item.name && item.unitPrice);
      await apiService.addMaterials(id, { items: validItems, notes: data.notes });
      toast.success('Materials saved! Customer has been notified to approve.');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save materials');
    } finally { setSubmitting(false); }
  }

  async function onCompleteJob(data) {
    if (!data.endOtp || data.endOtp.length !== 4) {
      toast.error('Please enter the 4-digit PIN from the customer');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported');
      return;
    }

    setCompleting(true);
    toast.loading('Verifying location...', { id: 'loc' });

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await apiService.completeJob(id, {
          workPerformed: data.workPerformed,
          extraCharges: Number(data.extraCharges) || 0,
          extraChargesNote: data.extraChargesNote,
          endOtp: data.endOtp,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        toast.dismiss('loc');
        toast.success('Job marked as complete!');
        navigate('/provider/bookings');
      } catch (err) {
        toast.dismiss('loc');
        toast.error(err.response?.data?.error || 'Failed to complete job');
        setCompleting(false);
      }
    }, (err) => {
      toast.dismiss('loc');
      toast.error('Location access required to complete job.');
      setCompleting(false);
    }, { timeout: 10000 });
  }

  if (!booking) return (
    <div className="min-h-screen bg-slate-50 pt-20 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 text-sm mb-5">
          <ChevronLeft size={16} /> Back
        </button>

        <h1 className="text-xl font-bold text-slate-900 mb-1">Complete Booking</h1>
        <p className="text-slate-500 text-sm mb-6">#{booking.bookingNumber} · {booking.serviceId?.name}</p>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8">
          {[{ n: 1, label: 'Materials' }, { n: 2, label: 'Work Details' }].map(({ n, label }) => (
            <React.Fragment key={n}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step >= n ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {step > n ? '✓' : n}
                </div>
                <span className={`text-sm font-medium ${step >= n ? 'text-primary-700' : 'text-slate-400'}`}>{label}</span>
              </div>
              {n < 2 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-primary-600' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <form>
          {step === 1 && (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Package size={18} className="text-primary-600" /> Materials Used
                  </h3>
                  <button type="button" onClick={() => append({ name: '', quantity: 1, unit: 'pcs', unitPrice: '', brand: '' })}
                    className="btn-secondary text-xs py-2 px-3 flex items-center gap-1">
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    No materials — click "Add Item" if any were used
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="p-4 bg-slate-50 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500 uppercase">Item {index + 1}</span>
                          <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <input {...register(`items.${index}.name`, { required: true })} placeholder="Item name *" className="input-field" />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <input type="number" {...register(`items.${index}.quantity`, { min: 0 })} placeholder="Qty" className="input-field" defaultValue={1} />
                          </div>
                          <div>
                            <select {...register(`items.${index}.unit`)} className="input-field">
                              {['pcs', 'ft', 'mtr', 'ltr', 'kg', 'box', 'roll'].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <input type="number" {...register(`items.${index}.unitPrice`, { min: 0 })} placeholder="Price ₹" className="input-field" />
                          </div>
                        </div>
                        <input {...register(`items.${index}.brand`)} placeholder="Brand (optional)" className="input-field" />
                        {items[index]?.quantity && items[index]?.unitPrice && (
                          <p className="text-xs text-right text-primary-600 font-semibold">
                            Subtotal: ₹{(Number(items[index].quantity) * Number(items[index].unitPrice)).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {fields.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Materials Total</span>
                    <span className="text-xl font-bold text-primary-700">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              <div className="card p-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes to Customer</label>
                <textarea {...register('notes')} rows={2} placeholder="Any notes about materials used…" className="input-field resize-none" />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
                💡 The customer will receive a notification to approve this materials list before payment.
              </div>

              <button type="button" onClick={handleSubmit(onSaveMaterials)} disabled={submitting} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">
                {submitting ? '…Saving' : 'Save Materials & Notify Customer →'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-slate-800 mb-4">Work Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Work Performed *</label>
                    <textarea {...register('workPerformed', { required: 'Required' })} rows={4} placeholder="Describe the work you performed in detail…" className="input-field resize-none" />
                    {errors.workPerformed && <p className="text-red-500 text-xs mt-1">{errors.workPerformed.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Extra Charges (if any)</label>
                    <input type="number" {...register('extraCharges')} placeholder="₹0" className="input-field" min={0} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Extra Charges Note</label>
                    <input {...register('extraChargesNote')} placeholder="Reason for extra charges…" className="input-field" />
                  </div>
                  <div className="pt-4 border-t border-slate-200">
                    <label className="block text-sm font-bold text-indigo-700 mb-3">🔐 Completion PIN (Ask Customer) *</label>
                    <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      {...register('endOtp', {
                        required: 'PIN is required',
                        pattern: { value: /^\d{4}$/, message: 'Must be exactly 4 digits' },
                      })}
                      placeholder="Enter 4-digit PIN"
                      className="input-field text-2xl tracking-[0.5em] text-center font-bold"
                      maxLength={4}
                    />
                    {errors.endOtp && <p className="text-red-500 text-xs mt-1 text-center">{errors.endOtp.message}</p>}
                  </div>
                </div>
              </div>

              {/* Final bill preview */}
              <div className="card p-5 bg-primary-50 border-primary-100">
                <h3 className="font-semibold text-slate-800 mb-3">Final Bill Preview</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Base price</span>
                    <span>₹{booking.basePrice}</span>
                  </div>
                  {subtotal > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Materials</span>
                      <span>₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-primary-200">
                    <span>Estimated Total</span>
                    <span className="text-primary-700">₹{(booking.basePrice + subtotal).toLocaleString('en-IN')}+</span>
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleSubmit(onCompleteJob)} disabled={completing}
                className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2">
                {completing ? '…Completing' : <><CheckCircle size={18} /> Mark Job Complete</>}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
