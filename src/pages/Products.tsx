import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import ProductCard from '@/components/ProductCard';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Products() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data: products, refetch, isFetching } = useQuery({
    queryKey: ['products', query],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (query.trim()) {
        q = q.ilike('name', `%${query.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!loading && !user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Header */}
      <section className="bg-gradient-to-br from-primary/10 via-secondary/5 to-background py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-pink-600 bg-clip-text text-transparent">
              Our Menu
            </h1>
            <p className="text-lg text-muted-foreground">
              Discover our delicious selection of cakes and pastries
            </p>
          </div>
        </div>
      </section>

      {/* Search + Products Grid */
      /* Show 1 product on mobile, 3 on desktop */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto mb-8 flex gap-2">
            <Input
              placeholder="Search cakes and pastries..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Searching...' : 'Search'}
            </Button>
          </div>
          {products && products.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onUpdate={refetch} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No items available at the moment.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
