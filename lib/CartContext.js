'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState({
    items: [],
    totalItems: 0,
    totalPrice: 0,
    itemCount: 0,
    loading: true,
    error: null
  });
  const [loading, setLoading] = useState(false);

  // Fetch cart on mount
  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const response = await fetch('/api/cart');
      const data = await response.json();
      
      if (data.success && data.cart) {
        setCart({
          items: data.cart.items || [],
          totalItems: data.cart.totalItems || 0,
          totalPrice: data.cart.totalPrice || 0,
          itemCount: data.cart.itemCount || 0,
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
      setCart(prev => ({ ...prev, loading: false, error: error.message }));
    }
  };

  const addToCart = async (
    productId,
    variationId = null,
    quantity = 1,
    selection = {}
  ) => {
    setLoading(true);

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          variationId,
          quantity,

          /*
          * Preserve product-page selections in the server cart. The cart route
          * uses these values to create selectedOptions and attributes, and the
          * checkout resolver validates them against the canonical variant.
          */
          color: selection.color ?? null,
          size: selection.size ?? null,
        }),
      });

      const data = await response.json();

      if (data.success && data.cart) {
        setCart({
          items: data.cart.items || [],
          totalItems: data.cart.totalItems || 0,
          totalPrice: data.cart.totalPrice || 0,
          itemCount: data.cart.itemCount || 0,
          loading: false,
          error: null,
        });

        return { success: true };
      }

      return {
        success: false,
        error: data.error || 'Unable to add item to cart.',
      };
    } catch (error) {
      console.error('Error adding to cart:', error);

      return {
        success: false,
        error: error.message,
      };
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (itemId) => {
    setLoading(true);
    try {
      const response = await fetch('/api/cart', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });

      const data = await response.json();
      
      if (data.success && data.cart) {
        setCart({
          items: data.cart.items || [],
          totalItems: data.cart.totalItems || 0,
          totalPrice: data.cart.totalPrice || 0,
          itemCount: data.cart.itemCount || 0,
          loading: false,
          error: null
        });
        return { success: true };
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    if (quantity < 1) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity })
      });

      const data = await response.json();
      
      if (data.success && data.cart) {
        setCart({
          items: data.cart.items || [],
          totalItems: data.cart.totalItems || 0,
          totalPrice: data.cart.totalPrice || 0,
          itemCount: data.cart.itemCount || 0,
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCart = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cart/clear', {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        setCart({
          items: [],
          totalItems: 0,
          totalPrice: 0,
          itemCount: 0,
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        fetchCart,
        loading
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
