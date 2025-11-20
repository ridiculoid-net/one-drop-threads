import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, ShoppingBag, X } from 'lucide-react';
import productsData from './data/products.json';

// Layout Components
const Navbar = ({ darkMode, setDarkMode }) => (
  <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-white/70 dark:bg-black/70 border-b border-gray-200 dark:border-gray-800">
    <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
      <h1 className="text-2xl font-bold tracking-tighter dark:text-white">
        ONE DROP THREADS
      </h1>
      <button 
        onClick={() => setDarkMode(!darkMode)}
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition"
      >
        {darkMode ? <Sun className="text-white" /> : <Moon />}
      </button>
    </div>
  </nav>
);

const ProductModal = ({ product, isOpen, onClose }) => {
  const [size, setSize] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleBuy = async () => {
    if (!size) return alert('Please select a size');
    setLoading(true);

    try {
      // Call our Cloudflare Backend
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          designId: product.id, 
          size: size,
          printUrl: product.printUrl,
          title: product.title,
          price: product.price
        }),
      });
      
      const { url, error } = await response.json();
      if (error) throw new Error(error);
      
      window.location.href = url; // Redirect to Stripe
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="relative bg-white dark:bg-gray-900 p-6 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
        >
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <X className="dark:text-white" />
          </button>
          
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/2 aspect-square bg-gray-100 rounded-lg overflow-hidden">
              <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <span className="inline-block px-2 py-1 text-xs font-bold bg-black text-white dark:bg-white dark:text-black rounded mb-2">
                  1 of 1 RARE
                </span>
                <h2 className="text-2xl font-bold dark:text-white mb-2">{product.title}</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{product.description}</p>
                <p className="text-xl font-mono dark:text-white mb-4">${(product.price / 100).toFixed(2)}</p>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium dark:text-gray-300 mb-2">Select Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['S', 'M', 'L', 'XL', '2XL'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`py-2 border rounded hover:border-black dark:hover:border-white transition ${
                          size === s 
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white' 
                            : 'border-gray-300 dark:border-gray-700 dark:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleBuy}
                disabled={loading}
                className="w-full bg-brand text-white py-3 rounded-lg font-bold hover:brightness-110 transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'BUY NOW'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inventory, setInventory] = useState({}); // Tracks { designId: "sold" | "available" }

  // Toggle Dark Mode Class
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Fetch Status from Backend on Load
  useEffect(() => {
    fetch('/api/inventory-status')
      .then(res => res.json())
      .then(data => setInventory(data))
      .catch(err => console.error("Failed to fetch inventory", err));
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-300">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      
      {/* Hero */}
      <section className="pt-32 pb-16 px-4 text-center">
        <motion.h1 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="text-5xl md:text-7xl font-bold mb-4 dark:text-white tracking-tighter"
        >
          RARE BY DESIGN.
        </motion.h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-8">
          Every shirt is a 1 of 1. Once it's bought, it's gone forever. 
          You pick the size, we destroy the design.
        </p>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {productsData.map((product) => {
            const isSold = inventory[product.id] === 'sold';
            return (
              <motion.div 
                key={product.id}
                layout
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`group relative cursor-pointer ${isSold ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                onClick={() => !isSold && setSelectedProduct(product)}
              >
                <div className="aspect-[4/5] bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden relative">
                  <img 
                    src={product.image} 
                    alt={product.title} 
                    className="w-full h-full object-cover transition duration-500 group-hover:scale-105" 
                  />
                  {isSold ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-white font-bold text-3xl border-4 border-white px-4 py-2 -rotate-12">
                        SOLD
                      </span>
                    </div>
                  ) : (
                    <div className="absolute top-4 left-4 bg-black dark:bg-white text-white dark:text-black px-2 py-1 text-xs font-bold rounded">
                      1 / 1
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <h3 className="font-medium dark:text-white">{product.title}</h3>
                  <span className="text-gray-500 dark:text-gray-400">${(product.price / 100).toFixed(2)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <ProductModal 
        product={selectedProduct} 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
    </div>
  );
}