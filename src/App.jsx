const handleBuy = async () => {
  if (!size) {
    alert('Please select a size');
    return;
  }
  setLoading(true);

  // Check if running locally
  const isDevelopment = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
  
  if (isDevelopment) {
    setTimeout(() => {
      alert(`✅ DEMO MODE\n\nProduct: ${product.title}\nSize: ${size}\nPrice: $${(product.price / 100).toFixed(2)}\n\nThis will check inventory and redirect to Stripe in production!`);
      setLoading(false);
      onClose();
    }, 1500);
    return;
  }

  // ⭐ PRODUCTION: Check inventory then redirect to Stripe
  try {
    const priceId = product.stripePrices?.[size];
    
    if (!priceId) {
      throw new Error(`No price configured for size ${size}`);
    }

    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        priceId: priceId,      // ← Stripe Price ID
        designId: product.id,  // ← For inventory check
        size: size,
        printUrl: product.printUrl
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout');
    }
    
    const data = await response.json();
    
    if (data.error) throw new Error(data.error);
    if (data.url) {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    }
    
  } catch (err) {
    console.error('Checkout error:', err);
    alert(err.message);
    setLoading(false);
  }
};