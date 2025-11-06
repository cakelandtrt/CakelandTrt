import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Heart, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    image_url: string | null;
    price_per_litre: number;
    offer_price_per_litre: number | null;
    stock_quantity: number;
  };
  onUpdate?: () => void;
  compact?: boolean;
}

export default function ProductCard({ product, onUpdate, compact = false }: ProductCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if product is in wishlist
  const { data: isInWishlist } = useQuery({
    queryKey: ['wishlist-status', product.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .single();
      return !!data;
    },
    enabled: !!user,
  });

  // Toggle wishlist mutation
  const toggleWishlistMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please login to add to wishlist');

      if (isInWishlist) {
        // Remove from wishlist
        const { error } = await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        if (error) throw error;
      } else {
        // Add to wishlist
        const { error } = await supabase
          .from('wishlist')
          .insert({
            user_id: user.id,
            product_id: product.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist');
      queryClient.invalidateQueries({ queryKey: ['wishlist-status', product.id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['wishlist', user?.id] });
      onUpdate?.();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/auth');
      return;
    }
    toggleWishlistMutation.mutate();
  };

  if (compact) {
    const volumeMatch = product.name.match(/(\d+\.?\d*[Ll])/);
    const volumeText = volumeMatch ? volumeMatch[1].toUpperCase() : product.name.slice(-2).toUpperCase();

    return (
      <div
        className="w-[1.5cm] h-[1.5cm] flex items-center justify-center bg-pink-300 rounded-lg cursor-pointer transition-all duration-300"
        onClick={() => navigate(`/product/${product.id}`)}
      >
        <span className="text-sm font-bold text-gray-800">{volumeText}</span>
      </div>
    );
  }

  return (
    <Card
      className="group overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[var(--shadow-hover)] relative"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      {user && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={handleWishlistClick}
          disabled={toggleWishlistMutation.isPending}
        >
          <Heart 
            className={`h-5 w-5 ${isInWishlist ? 'fill-red-500 text-red-500' : ''}`}
          />
        </Button>
      )}
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.image_url || '/placeholder.svg'}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg line-clamp-2">{product.name}</h3>
      </CardContent>
    </Card>
  );
}
