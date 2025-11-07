import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type CouponFormState = {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string;
  valid_until: string;
  is_active: boolean;
};

type CouponMutationPayload = {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  valid_until: string | null;
  is_active: boolean;
};

const getDefaultFormState = (): CouponFormState => ({
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  min_order_amount: '',
  max_discount_amount: '',
  valid_until: '',
  is_active: true,
});

const toLocalDateTimeInputValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

const toISOStringFromLocalInput = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export default function AdminCoupons() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [formData, setFormData] = useState<CouponFormState>(getDefaultFormState);

  const resetForm = () => {
    setEditingCoupon(null);
    setFormData(getDefaultFormState());
  };

  const { data: coupons } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const formattedCoupons = useMemo(() => {
    if (!Array.isArray(coupons)) return [];
    return coupons.map((coupon) => ({
      ...coupon,
      validUntilLabel: coupon.valid_until ? format(new Date(coupon.valid_until), 'dd MMM yyyy, hh:mm a') : null,
    }));
  }, [coupons]);

  const createCouponMutation = useMutation({
    mutationFn: async ({ payload, id }: { payload: CouponMutationPayload; id?: string }) => {
      if (id) {
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCoupon ? 'Coupon updated' : 'Coupon created');
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (error: any) => {
      const message = error?.message || 'Failed to save coupon';
      toast.error(message);
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: async (couponId: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', couponId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Coupon deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (error: any) => {
      const message = error?.message || 'Failed to delete coupon';
      toast.error(message);
    },
  });

  const handleEdit = (coupon: any) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value?.toString() || '',
      min_order_amount: coupon.min_order_amount?.toString() || '',
      max_discount_amount: coupon.max_discount_amount?.toString() || '',
      valid_until: toLocalDateTimeInputValue(coupon.valid_until),
      is_active: coupon.is_active ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const trimmedCode = formData.code.trim().toUpperCase();
    if (!trimmedCode) {
      toast.error('Coupon code is required');
      return;
    }

    const discountValue = Number(formData.discount_value);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      toast.error('Enter a valid discount value greater than 0');
      return;
    }

    if (formData.discount_type === 'percentage' && discountValue > 100) {
      toast.error('Percentage discount cannot exceed 100');
      return;
    }

    const minOrderAmount = formData.min_order_amount ? Number(formData.min_order_amount) : null;
    if (minOrderAmount !== null && (!Number.isFinite(minOrderAmount) || minOrderAmount < 0)) {
      toast.error('Minimum order amount must be 0 or greater');
      return;
    }

    const maxDiscountAmount = formData.max_discount_amount ? Number(formData.max_discount_amount) : null;
    if (maxDiscountAmount !== null && (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 0)) {
      toast.error('Max discount amount must be 0 or greater');
      return;
    }

    const validUntilIso = toISOStringFromLocalInput(formData.valid_until);
    if (validUntilIso && new Date(validUntilIso) <= new Date()) {
      toast.error('Valid until must be a future date and time');
      return;
    }

    const payload: CouponMutationPayload = {
      code: trimmedCode,
      discount_type: formData.discount_type,
      discount_value: Number(discountValue.toFixed(2)),
      min_order_amount: minOrderAmount !== null ? Number(minOrderAmount.toFixed(2)) : null,
      max_discount_amount: maxDiscountAmount !== null ? Number(maxDiscountAmount.toFixed(2)) : null,
      valid_until: validUntilIso,
      is_active: formData.is_active,
    };

    createCouponMutation.mutate({ payload, id: editingCoupon?.id || undefined });
  };

  const handleDiscountTypeChange = (value: string) => {
    if (value !== 'percentage' && value !== 'fixed') {
      return;
    }
    setFormData((prev) => ({ ...prev, discount_type: value }));
  };

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Manage Coupons</h1>
          <Button onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}>Add Coupon</Button>
        </div>

        <div className="grid gap-4">
          {formattedCoupons?.map((coupon) => (
            <Card key={coupon.id}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold">{coupon.code}</h3>
                  <div className="space-y-1 text-sm text-muted-foreground mt-1">
                    <p className="text-sm text-foreground">
                      {coupon.discount_type === 'percentage'
                        ? `${coupon.discount_value}% off`
                        : `₹${coupon.discount_value} off`}
                    </p>
                    {coupon.max_discount_amount && (
                      <p className="text-xs">Max discount: ₹{coupon.max_discount_amount}</p>
                    )}
                    {coupon.min_order_amount && (
                      <p className="text-xs">Min order: ₹{coupon.min_order_amount}</p>
                    )}
                    {coupon.validUntilLabel && (
                      <p className="text-xs">Valid until: {coupon.validUntilLabel}</p>
                    )}
                    <div className="text-xs flex items-center gap-2">
                      Status:
                      <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(coupon)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this coupon?')) {
                        deleteCouponMutation.mutate(coupon.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Add Coupon'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Code</Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={formData.discount_type} onValueChange={handleDiscountTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input type="number" value={formData.discount_value} onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })} />
              </div>
              <div>
                <Label>Min Order (₹)</Label>
                <Input type="number" value={formData.min_order_amount} onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })} />
              </div>
              <div>
                <Label>Max Discount (₹)</Label>
                <Input
                  type="number"
                  value={formData.max_discount_amount}
                  onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                  placeholder="Optional cap on discount"
                />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input
                  type="datetime-local"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  min={toLocalDateTimeInputValue(new Date().toISOString())}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-xs text-muted-foreground">Inactive coupons cannot be applied at checkout</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={createCouponMutation.isPending}>
                {createCouponMutation.isPending ? 'Saving...' : editingCoupon ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
