'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner'; // ADD THIS LINE

/**
 * Cart Context
 * 
 * Provides cart state management and API methods for the entire application.
 * 
 * Usage:
 * 1. Wrap your app with <CartProvider>
 * 2. Use const { cart, addToCart, ... } = useCart() in components
 */

// Create context
const CartContext = createContext(null);

// Initial cart state
const initialState = {
  items: [],
  totalItems: 0,
  totalPrice: 0,
  itemCount: 0,
  loading: false,
  error: null
};

/**
 * CartProvider Component
 * 
 * Wrap your application with this provider to enable cart functionality.
 * 
 * @example
 * <CartProvider>
 *   <App />
 * </CartProvider>
 */
export function CartProvider({ children }) {
  const [cart, setCart] = useState(initialState);
  
  /**
   * Refresh cart from API
   */
  const refreshCart = useCallback(async () => {
    try {
      setCart(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch('/api/cart', {
        method: 'GET',
        credentials: 'include' // Include cookies
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
      } else {
        setCart({
          ...initialState,
          loading: false
        });
      }
    } catch (error) {
      console.error('Failed to refresh cart:', error);
      setCart(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load cart'
      }));
    }
  }, []);
  
 /**
 * Add item to cart
 * @param {string} productId - Product ID
 * @param {string} variationId - Variation ID
 * @param {number} quantity - Quantity to add (default: 1)
 * @param {{ color?: string | null, size?: string | null }} selection - Chosen variant attributes
 * @returns {Promise<{success: boolean, error?: string}>}
 */
  const addToCart = useCallback(async (
    productId,
    variationId,
    quantity = 1,
    selection = {}
  ) => {
  try {
    setCart(prev => ({ ...prev, loading: true, error: null }));
    
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        productId,
        variationId,
        quantity,
        color: selection.color ?? null,
        colorKey: selection.colorKey ?? null,
        size: selection.size ?? null,
      })
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
    } else {
      setCart(prev => ({
        ...prev,
        loading: false,
        error: data.error || 'Failed to add item'
      }));
      toast.error(data.error || 'Failed to add to cart'); // ADD THIS LINE
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Failed to add to cart:', error);
    setCart(prev => ({
      ...prev,
      loading: false,
      error: 'Failed to add item to cart'
    }));
    toast.error('Failed to add to cart'); // ADD THIS LINE
    return { success: false, error: 'Network error' };
  }
}, []);

  
  /**
   * Update item quantity
   * @param {string} productId - Product ID
   * @param {string} variationId - Variation ID
   * @param {number} quantity - New quantity (0 removes item)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const updateQuantity = useCallback(async (productId, variationId, quantity) => {
    try {
      setCart(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ productId, variationId, quantity })
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
      } else {
        setCart(prev => ({
          ...prev,
          loading: false,
          error: data.error || 'Failed to update quantity'
        }));
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Failed to update quantity:', error);
      setCart(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to update quantity'
      }));
      return { success: false, error: 'Network error' };
    }
  }, []);
  
  /**
   * Remove item from cart
   * @param {string} productId - Product ID
   * @param {string} variationId - Variation ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const removeFromCart = useCallback(async (productId, variationId) => {
    try {
      setCart(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch('/api/cart/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ productId, variationId })
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
      } else {
        setCart(prev => ({
          ...prev,
          loading: false,
          error: data.error || 'Failed to remove item'
        }));
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      setCart(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to remove item'
      }));
      return { success: false, error: 'Network error' };
    }
  }, []);
  
  /**
   * Clear entire cart
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const clearCart = useCallback(async () => {
    try {
      setCart(prev => ({ ...prev, loading: true, error: null }));
      
      // Remove all items by setting quantity to 0 for each
      // Or we could add a dedicated clear endpoint
      const currentItems = cart.items;
      
      for (const item of currentItems) {
        await fetch('/api/cart/remove', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            productId: item.productId,
            variationId: item.variationId
          })
        });
      }
      
      setCart({
        ...initialState,
        loading: false
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to clear cart:', error);
      setCart(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to clear cart'
      }));
      return { success: false, error: 'Network error' };
    }
  }, [cart.items]);
  
  /**
   * Check if a specific item is in cart
   * @param {string} productId - Product ID
   * @param {string} variationId - Variation ID
   * @returns {boolean}
   */
  const isInCart = useCallback((productId, variationId) => {
    return cart.items.some(
      item => item.productId === productId && item.variationId === variationId
    );
  }, [cart.items]);
  
  /**
   * Get quantity of specific item in cart
   * @param {string} productId - Product ID
   * @param {string} variationId - Variation ID
   * @returns {number}
   */
  const getItemQuantity = useCallback((productId, variationId) => {
    const item = cart.items.find(
      item => item.productId === productId && item.variationId === variationId
    );
    return item?.quantity || 0;
  }, [cart.items]);
  
  // Auto-fetch cart on mount
  useEffect(() => {
    let mounted = true;
    
    const fetchInitialCart = async () => {
      if (!mounted) return;
      
      try {
        const response = await fetch('/api/cart', {
          method: 'GET',
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (mounted && data.success && data.cart) {
          setCart({
            items: data.cart.items || [],
            totalItems: data.cart.totalItems || 0,
            totalPrice: data.cart.totalPrice || 0,
            itemCount: data.cart.itemCount || 0,
            loading: false,
            error: null
          });
        } else if (mounted) {
          setCart({
            ...initialState,
            loading: false
          });
        }
      } catch (error) {
        console.error('Failed to load cart:', error);
        if (mounted) {
          setCart({
            ...initialState,
            loading: false,
            error: 'Failed to load cart'
          });
        }
      }
    };
    
    fetchInitialCart();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  // Context value
  const value = {
    // State
    cart,
    items: cart.items,
    totalItems: cart.totalItems,
    totalPrice: cart.totalPrice,
    itemCount: cart.itemCount,
    loading: cart.loading,
    error: cart.error,
    
    // Actions
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart,
    
    // Helpers
    isInCart,
    getItemQuantity
  };
  
  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

/**
 * useCart Hook
 * 
 * Access cart state and methods in any component.
 * Must be used within a CartProvider.
 * 
 * @example
 * const { addToCart, totalItems } = useCart();
 * 
 * @returns {Object} Cart context value
 */
export function useCart() {
  const context = useContext(CartContext);
  
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  
  return context;
}

export default CartContext;
