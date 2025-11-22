import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, X, Check } from 'lucide-react';
import productsData from './data/products.json';

// Layout Components
const Navbar = ({ darkMode, setDarkMode }) => (
  <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-white/90 dark:bg-black/90 border-b border-gray-200 dark:border-gray-800 transition-colors">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
      <motion.h1 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-xl sm:text-2xl font-bold tracking-tighter dark:text-white"
      >
        ONE DROP THREADS
      </motion.h1>
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setDarkMode(!darkMode)}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Toggle dark mode"
      >
        <motion.div
          initial={false}
          animate={{ rotate: darkMode ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {darkMode ? (
            <Sun className="text-yellow-400 w-5 h-5" />
          ) : (
            <Moon className="text-gray-700 w-5 h-5" />
          )}
        </motion.div>
      </motion.button>
    </div>
  </nav>
);

const ProductModal = ({ product, isOpen, onClose }) => {
  const [size, setSize] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const handleBuy = async () => {
    if (!size) {
      alert('Please select a size');
      return;
    }
    setLoading(true);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          designId: product.id, 
          size: size,
          printUrl: product.printUrl,
          title: product.title,
          price: product.price,
          sizeMap: product.sizeMap
        }),
      });
      
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose} 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative bg-white dark:bg-gray-900 p-6 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-10"
            aria-label="Close modal"
          >
            <X className="dark:text-white w-5 h-5" />
          </button>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Image */}
            <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
              <img 
                src={product.image} 
                alt={product.title} 
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Details */}
            <div className="flex flex-col justify-between">
              <div>
                <motion.span 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-block px-3 py-1 text-xs font-bold bg-black text-white dark:bg-white dark:text-black rounded-full mb-3"
                >
                  1 OF 1 RARE
                </motion.span>
                <h2 className="text-2xl md:text-3xl font-bold dark:text-white mb-3 leading-tight">
                  {product.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                  {product.description}
                </p>
                <div className="flex items-baseline gap-2 mb-6">
                  <p className="text-2xl font-bold dark:text-white">
                    ${(product.price / 100).toFixed(2)}
                  </p>
                  <span className="text-sm text-gray-500 dark:text-gray-400">USD</span>
                </div>
                
                {/* Size Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold dark:text-gray-300 mb-3">
                    Select Size
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {['S', 'M', 'L', 'XL', '2XL'].map((s) => (
                      <motion.button
                        key={s}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSize(s)}
                        className={`py-3 border-2 rounded-lg font-semibold transition-all relative ${
                          size === s 
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white' 
                            : 'border-gray-300 dark:border-gray-700 dark:text-white hover:border-gray-400 dark:hover:border-gray-600'
                        }`}
                      >
                        {s}
                        {size === s && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1"
                          >
                            <Check className="w-4 h-4" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBuy}
                disabled={loading || !size}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent rounded-full"
                    />
                    Processing...
                  </span>
                ) : (
                  'BUY NOW'
                )}
              </motion.button>
              
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
                Once purchased, this design is destroyed forever
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);

  // Persist dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Fetch inventory status
  useEffect(() => {
    fetch('/api/inventory-status')
      .then(res => res.json())
      .then(data => {
        setInventory(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch inventory", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-300">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 text-center">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 dark:text-white tracking-tighter leading-tight">
            RARE BY DESIGN.
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed px-4">
            Every shirt is a 1 of 1. Once it's bought, it's gone forever. 
            You pick the size, we destroy the design.
          </p>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="inline-block px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-semibold"
          >
            Limited Collection
          </motion.div>
        </motion.div>
      </section>

      {/* Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-gray-300 dark:border-gray-700 border-t-black dark:border-t-white rounded-full"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {productsData.map((product, index) => {
              const isSold = inventory[product.id] === 'sold';
              return (
                <motion.div 
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`group relative cursor-pointer ${isSold ? 'pointer-events-none' : ''}`}
                  onClick={() => !isSold && setSelectedProduct(product)}
                >
                  <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden relative shadow-lg hover:shadow-2xl transition-shadow duration-300">
                    <motion.img 
                      src={product.image} 
                      alt={product.title} 
                      className={`w-full h-full object-cover transition-all duration-500 ${
                        isSold ? 'grayscale' : 'group-hover:scale-105'
                      }`}
                      loading="lazy"
                    />
                    
                    {isSold ? (
                      <motion.div 
                        initial={{ opacity: 0, rotate: -12 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                      >
                        <span className="text-white font-bold text-4xl border-4 border-white px-6 py-3 -rotate-12 shadow-2xl">
                          SOLD
                        </span>
                      </motion.div>
                    ) : (
                      <>
                        <div className="absolute top-4 left-4 bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 text-xs font-bold rounded-full shadow-lg">
                          1 / 1
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </>
                    )}
                  </div>
                  
                  <div className="mt-4 flex justify-between items-start gap-2">
                    <h3 className="font-semibold dark:text-white text-lg leading-tight">
                      {product.title}
                    </h3>
                    <span className="text-gray-900 dark:text-gray-100 font-bold whitespace-nowrap">
                      ${(product.price / 100).toFixed(2)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © 2025 One Drop Threads. Each design destroyed after first purchase.
          </p>
        </div>
      </footer>

      <ProductModal 
        product={selectedProduct} 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
      />
    </div>
  );
}