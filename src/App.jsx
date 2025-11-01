import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, addDoc, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { ShoppingCart, ChefHat, BellRing, Utensils, IndianRupee, X, Check, Soup, ChevronUp, ChevronDown } from 'lucide-react';
import './App.css'; // Add App.css import so theme rules are loaded

// --- Global Variable Handling ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Ingredient and Menu Definitions ---
const INGREDIENTS = {
    VEGETABLES: [
        { id: 'onion', name: 'Onion', price: 0, default: true },
        { id: 'corn', name: 'Corn', price: 0, default: true },
        { id: 'capsicum', name: 'Capsicum', price: 0, default: true },
        { id: 'tomato', name: 'Tomato', price: 0, default: true },
        { id: 'mushroom', name: 'Mushroom', price: 10, default: false }, // Optional paid
        { id: 'cabbage', name: 'Cabbage', price: 0, default: true },
        { id: 'carrot', name: 'Carrot', price: 0, default: true },
        { id: 'beetroot', name: 'Beetroot', price: 0, default: true },
    ],
    PULSES: [
        { id: 'chana', name: 'Chana', price: 0, default: false },
        { id: 'sprouts', name: 'Sprouts', price: 0, default: false },
        { id: 'bean', name: 'Bean', price: 0, default: false },
    ],
    SAUCES_AND_TOPPINGS: [
        { id: 'cheese', name: 'Cheese (Extra)', price: 15, default: false },
        { id: 'paneer', name: 'Add Paneer', price: 20, default: false }, // added paneer option (+20 INR)
        { id: 'red-ketchup', name: 'Red Ketchup', price: 0, default: true },
        { id: 'schezwan', name: 'Schezwan Chutney', price: 0, default: true },
        { id: 'mayonnaise', name: 'Mayonnaise', price: 10, default: false }, // Optional paid
        { id: 'tandoori-sauce', name: 'Tandoori Sauce', price: 10, default: false }, // Optional paid
    ],
};

const ALL_INGREDIENTS_FLAT = Object.values(INGREDIENTS).flat();
// FIX: Corrected typo from ALL_INGREINTS_FLAT to ALL_INGREDIENTS_FLAT
const DEFAULT_INGREDIENT_IDS = ALL_INGREDIENTS_FLAT.filter(i => i.default).map(i => i.id);

const MENU_ITEMS = [
    { id: 'frankie', name: 'Frankie', price: 60, category: 'Rolls', customizable: true }, // combined Frankie; paneer available in customizer (+20 INR)
    { id: 'bhel', name: 'Bhel Puri', price: 30, category: 'Chaat', customizable: false },
    { id: 'mix-chips', name: 'Mix Chips (Large)', price: 40, category: 'Snacks', customizable: true },
]

const OrderStatus = {
    NEW: 'New Order',
    PREPARING: 'Preparing',
    READY: 'Ready for Collection',
    COLLECTED: 'Collected',
};

// Utility function to format currency
const formatPrice = (price) => `₹${price.toFixed(2)}`;

// Component for Customization Modal (Used by CustomerView)
const FrankieCustomizer = ({ item, onClose, onAddToCart }) => {
    const [quantity, setQuantity] = useState(1);
    const [selectedIngredients, setSelectedIngredients] = useState(DEFAULT_INGREDIENT_IDS);
    const [customPrice, setCustomPrice] = useState(item.price);

    // Calculate price whenever ingredients or quantity changes
    useEffect(() => {
        let extraCost = 0;
        ALL_INGREDIENTS_FLAT.forEach(ing => {
            if (selectedIngredients.includes(ing.id) && ing.price > 0) {
                extraCost += ing.price;
            }
        });
        setCustomPrice(item.price + extraCost);
    }, [selectedIngredients, item.price]);

    const toggleIngredient = (id) => {
        setSelectedIngredients(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleQuickAddAll = () => {
        const allIds = ALL_INGREDIENTS_FLAT.map(i => i.id);
        setSelectedIngredients(allIds);
    };

    const handleFinalAdd = () => {
        // Compile final item data including selected ingredients and final price
        const finalItem = {
            ...item,
            id: `${item.id}-${Date.now()}`, // Ensure unique ID for multiple customized items
            customizations: selectedIngredients,
            unitPrice: customPrice,
            quantity: quantity
        };
        onAddToCart(finalItem);
        onClose();
    };

    const currentTotal = customPrice * quantity;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 p-4">
            <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl p-6 transform transition-all duration-300">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{item.name} Customization</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Quick Add Option */}
                <button
                    onClick={handleQuickAddAll}
                    className="w-full py-3 px-4 mb-4 bg-indigo-100 border-2 border-indigo-500 text-indigo-700 font-semibold rounded-xl hover:bg-indigo-200 transition duration-200 flex items-center justify-center shadow-md"
                >
                    <Check className="w-5 h-5 mr-2" /> Add All Standard Ingredients
                </button>

                {/* Ingredient Customization */}
                <div className="h-64 overflow-y-auto pr-2 space-y-4">
                    {Object.entries(INGREDIENTS).map(([category, ingredients]) => (
                        <div key={category}>
                            <h4 className="text-lg font-bold text-gray-700 mb-2 border-b-2 border-gray-100 pt-2">{category.replace('_', ' ')}</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {ingredients.map(ing => (
                                    <button
                                        key={ing.id}
                                        onClick={() => toggleIngredient(ing.id)}
                                        className={`p-3 rounded-lg text-left transition duration-150 border-2 ${
                                            selectedIngredients.includes(ing.id)
                                                ? 'bg-green-100 border-green-500 text-green-700 font-semibold'
                                                : 'bg-gray-50 border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        {ing.name}
                                        {ing.price > 0 && <span className="ml-2 text-xs font-medium bg-indigo-500 text-white rounded-full px-2 py-0.5">+ {formatPrice(ing.price)}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quantity and Final Total */}
                <div className="mt-6 pt-4 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-bold text-gray-800">Quantity:</span>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition"
                            >
                                <ChevronDown className="w-5 h-5" />
                            </button>
                            <span className="text-2xl font-extrabold text-indigo-600 w-8 text-center">{quantity}</span>
                            <button
                                onClick={() => setQuantity(q => q + 1)}
                                className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition"
                            >
                                <ChevronUp className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-gray-800">Total Price:</span>
                        <span className="text-2xl font-extrabold text-green-600">{formatPrice(currentTotal)}</span>
                    </div>

                    <button
                        onClick={handleFinalAdd}
                        className="mt-4 w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition duration-300 transform active:scale-95"
                    >
                        Add {quantity} {item.name} to Cart
                    </button>
                </div>
            </div>
        </div>
    );
};


// Component for the Customer's Menu/Ordering Interface
const CustomerView = ({ db, userId, orderCollectionPath }) => {
    const [cart, setCart] = useState([]);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [lastPlacedOrderId, setLastPlacedOrderId] = useState(null);
    const [currentOrderStatus, setCurrentOrderStatus] = useState(null);
    const [itemToCustomize, setItemToCustomize] = useState(null); // New state for customization

    // 1. Live listener for the customer's last order status
    useEffect(() => {
        if (!db || !userId || !lastPlacedOrderId) return;

        const docRef = doc(db, orderCollectionPath, lastPlacedOrderId);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setCurrentOrderStatus(docSnap.data().status);
            }
        });

        return () => unsubscribe();
    }, [db, userId, lastPlacedOrderId, orderCollectionPath]);

    // Handlers
    const handleMenuClick = (item) => {
        if (item.customizable) {
            setItemToCustomize(item); // Open customization modal
        } else {
            addToCart(item); // Add non-customizable item directly
        }
    };

    const addToCart = (item, quantity = 1) => {
        // For non-customizable items, group them
        if (!item.customizable) {
            setCart(prevCart => {
                const existing = prevCart.find(i => i.id === item.id && !i.customizations);
                if (existing) {
                    return prevCart.map(i =>
                        i.id === item.id && !i.customizations ? { ...i, quantity: i.quantity + quantity } : i
                    );
                }
                return [...prevCart, { ...item, quantity, unitPrice: item.price }];
            });
        } else {
            // For customized items, each instance is unique
            setCart(prevCart => [...prevCart, item]);
        }
    };

    const removeCartItem = (itemId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== itemId));
    };

    const updateCartItemQuantity = (itemId, change) => {
        setCart(prevCart => {
            const updatedCart = prevCart.map(i => {
                if (i.id === itemId) {
                    const newQuantity = i.quantity + change;
                    return newQuantity > 0 ? { ...i, quantity: newQuantity } : null;
                }
                return i;
            }).filter(Boolean);
            return updatedCart;
        });
    };

    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.unitPrice || item.price) * item.quantity, 0), [cart]);

    // 2. Place Order (MODIFIED with Razorpay)
    const handlePlaceOrder = async () => {
        if (cart.length === 0 || cartTotal === 0) return;

        setIsPlacingOrder(true);

        // Check if Razorpay script is loaded
        if (!window.Razorpay) {
            alert('Error: Payment gateway is not loaded. Please refresh the page.');
            setIsPlacingOrder(false);
            return;
        }
        
        const options = {
            // ===================================================================
            // !!! IMPORTANT !!!
            // This is a PUBLIC TEST KEY.
            // You MUST replace this with your own Key ID from the Razorpay Dashboard.
            key: 'rzp_test_R8Pjr1V054idbz', 
            // ===================================================================
            amount: cartTotal * 100 , // Amount in paise (e.g., 50.00 INR = 5000 paise)
            currency: 'INR',
            name: 'Mamba Foods', // Your business name
            description: 'Stall Order Payment',
            // image: 'src/assets/logo.png', // You can add your logo URL here
            
            handler: async (response) => {
                // This function is called on successful payment
                try {
                    const simplifiedCart = cart.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.unitPrice || item.price,
                        customizations: item.customizations || null,
                        notes: item.notes || null,
                    }));

                    const newOrder = {
                        userId: userId,
                        items: simplifiedCart,
                        total: cartTotal,
                        status: OrderStatus.NEW,
                        timestamp: serverTimestamp(),
                        orderId: Math.floor(Math.random() * 900) + 100, // Simple 3-digit number for display
                        paymentId: response.razorpay_payment_id, // Store the payment ID from Razorpay
                    };

                    const docRef = await addDoc(collection(db, orderCollectionPath), newOrder);
                    setLastPlacedOrderId(docRef.id);
                    setCurrentOrderStatus(OrderStatus.NEW);
                    setCart([]); // Clear cart after successful order
                
                } catch (error) {
                    console.error("Error saving order after payment:", error);
                    alert("Payment was successful, but there was an error saving your order. Please contact staff immediately.");
                } finally {
                    // This finally block runs after the 'try' or 'catch' inside the handler
                    // We set placing order to false here because the payment process is complete.
                    setIsPlacingOrder(false);
                }
            },
            prefill: {
                // You can prefill customer details if you collect them
                name: 'IIT-GN Customer', 
                email: '',
                contact: ''
            },
            notes: {
                address: 'IIT Gandhinagar Campus'
            },
            theme: {
                color: '#4F46E5' // Indigo color to match your theme
            }
        };

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', (response) => {
            console.error('Payment Failed:', response.error);
            alert(`Payment failed. Reason: ${response.error.description || 'Unknown'}. Please try again.`);
            // Re-enable the button if payment fails
            setIsPlacingOrder(false);
        });

        // Open the Razorpay checkout modal
        // The 'finally' block in the main function is removed, 
        // as setIsPlacingOrder(false) is now handled by the 'handler' (on success) 
        // and 'payment.failed' (on failure).
        rzp.open();
    };

    // --- RENDERING ---

    // Render Customization Modal if an item is selected
    if (itemToCustomize) {
        return <FrankieCustomizer
            item={itemToCustomize}
            onClose={() => setItemToCustomize(null)}
            onAddToCart={(item) => addToCart(item)}
        />;
    }

    if (lastPlacedOrderId) {
        // Order Status Screen (After placing order)
        const statusColor = {
            [OrderStatus.NEW]: 'bg-yellow-500',
            [OrderStatus.PREPARING]: 'bg-blue-500',
            [OrderStatus.READY]: 'bg-green-600 animate-pulse',
            [OrderStatus.COLLECTED]: 'bg-gray-400',
        }[currentOrderStatus] || 'bg-gray-200';

        const statusMessage = {
            [OrderStatus.NEW]: 'Payment Received! Order is in the queue.',
            [OrderStatus.PREPARING]: 'The chef is preparing your delicious meal!',
            [OrderStatus.READY]: 'Your order is ready! Please collect it from the stall.',
            [OrderStatus.COLLECTED]: 'Thank you! Enjoy your food!',
        }[currentOrderStatus] || 'Checking Status...';

        return (
            <div className="p-4 flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl text-center">
                    <BellRing className="w-16 h-16 mx-auto text-yellow-600 mb-4" />
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Confirmed!</h1>
                    <p className="text-sm text-gray-600 mb-6">{statusMessage}</p>

                    <div className={`p-4 rounded-lg text-white font-semibold text-xl ${statusColor} shadow-lg transition duration-500`}>
                        {currentOrderStatus}
                    </div>
                    <p className="mt-4 text-xs text-gray-500">
                        Keep this screen open to track your order status live!
                    </p>

                    <button
                        onClick={() => setLastPlacedOrderId(null)}
                        className="mt-8 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-300"
                    >
                        Start New Order
                    </button>
                </div>
            </div>
        );
    }

    // Menu and Cart Screen (Initial state)
    return (
        <div className="p-4 pb-28 bg-gray-50 min-h-screen">
            <div className="max-w-2xl mx-auto">
                <header className="app-header">
                    <img
                        src="src\assets\logo.png"
                        alt="Mamba Foods Logo"
                        className="app-logo"
                    />
                </header>

                {/* Menu Items */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-700 mt-4 mb-2">Our Menu</h2>
                    {MENU_ITEMS.map(item => (
                        <div key={item.id} className="menu-item">
                            <div className="left">
                                <p className="name">{item.name}</p>
                                <p className="price">
                                    {formatPrice(item.price)}
                                    {item.customizable && <span className="customize">(Customize)</span>}
                                </p>
                            </div>
                            <button onClick={() => handleMenuClick(item)} className="add-button">
                                Add
                            </button>
                        </div>
                    ))}
                </section>

                {/* Floating Cart Summary */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-4 border-indigo-600 shadow-2xl">
                    <div className="cart-panel">
                        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                            <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
                            Your Cart
                        </h2>
                        {cart.length === 0 ? (
                            <p className="text-sm text-gray-500">Your cart is empty. Add some items!</p>
                        ) : (
                            <>
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700">{item.name}</p>
                                            {item.customizations && (
                                                <p className="text-xs text-gray-500 italic truncate ml-1">
                                                    Custom: {item.customizations.map(id => ALL_INGREDIENTS_FLAT.find(i => i.id === id)?.name).join(', ')}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center space-x-2 ml-4">
                                            {/* For non-customizable items, allow quantity change. Customized items should be removed and re-added */}
                                            {!item.customizable ? (
                                                <>
                                                    <button onClick={() => updateCartItemQuantity(item.id, -1)} className="text-indigo-500 hover:text-indigo-700 p-1">
                                                        -
                                                    </button>
                                                    <span className="font-bold text-gray-800 w-4 text-center">{item.quantity}</span>
                                                    <button onClick={() => updateCartItemQuantity(item.id, 1)} className="text-indigo-500 hover:text-indigo-700 p-1">
                                                        +
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="font-bold text-gray-800 w-4 text-center">{item.quantity}</span>
                                            )}

                                            <span className="text-sm text-gray-500 ml-4">{formatPrice((item.unitPrice || item.price) * item.quantity)}</span>
                                            <button onClick={() => removeCartItem(item.id)} className="text-red-500 hover:text-red-700 p-1">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-3 mt-3 border-t-2 border-gray-200">
                                    <span className="text-lg font-bold text-gray-800">Total:</span>
                                    <span className="text-xl font-extrabold text-indigo-600">{formatPrice(cartTotal)}</span>
                                </div>
                                <button
                                    onClick={handlePlaceOrder}
                                    disabled={cart.length === 0 || isPlacingOrder}
                                    className={`mt-4 w-full py-3 rounded-xl font-bold transition duration-300 shadow-lg ${
                                        cart.length === 0 || isPlacingOrder
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-green-500 hover:bg-green-600 text-white transform active:scale-95'
                                    }`}
                                >
                                    {isPlacingOrder ? 'Processing Payment...' : `Confirm & Pay ${formatPrice(cartTotal)}`}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Component for the Staff's Kitchen Display System (KDS)
const StallView = ({ db, orderCollectionPath }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Live listener for ALL orders
    useEffect(() => {
        if (!db) return;

        // Query for all orders, sorted by timestamp (newest first)
        // NOTE: orderBy('timestamp', 'desc') is used, but if Firestore complains about missing indexes,
        // we would remove it and sort client-side.
        const ordersQuery = query(
            collection(db, orderCollectionPath),
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Format timestamp for display
                timestamp: doc.data().timestamp?.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || 'N/A'
            }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching orders:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, orderCollectionPath]);

    // Handler to update the status of an order
    const updateStatus = useCallback(async (orderId, currentStatus) => {
        if (!db) return;

        let nextStatus;
        switch (currentStatus) {
            case OrderStatus.NEW:
                nextStatus = OrderStatus.PREPARING;
                break;
            case OrderStatus.PREPARING:
                nextStatus = OrderStatus.READY;
                break;
            case OrderStatus.READY:
                nextStatus = OrderStatus.COLLECTED;
                break;
            default:
                return; // Don't change collected orders
        }

        try {
            const docRef = doc(db, orderCollectionPath, orderId);
            await updateDoc(docRef, { status: nextStatus });
        } catch (error) {
            console.error("Error updating order status:", error);
        }
    }, [db, orderCollectionPath]);

    // Helper to determine button text and color
    const getNextActionButton = (order) => {
        switch (order.status) {
            case OrderStatus.NEW:
                return { text: 'Start Preparing', color: 'bg-yellow-500 hover:bg-yellow-600' };
            case OrderStatus.PREPARING:
                return { text: 'Ready for Pickup!', color: 'bg-green-500 hover:bg-green-600' };
            case OrderStatus.READY:
                return { text: 'Mark Collected', color: 'bg-gray-500 hover:bg-gray-600' };
            default:
                return { text: 'Collected', color: 'bg-gray-300 cursor-not-allowed', disabled: true };
        }
    };

    const getStatusBadge = (status) => {
        let color = '';
        switch (status) {
            case OrderStatus.NEW:
                color = 'bg-red-500';
                break;
            case OrderStatus.PREPARING:
                color = 'bg-blue-500';
                break;
            case OrderStatus.READY:
                color = 'bg-green-500 animate-pulse';
                break;
            case OrderStatus.COLLECTED:
                color = 'bg-gray-400';
                break;
            default:
                color = 'bg-gray-200';
        }
        return <span className={`text-xs font-semibold px-2 py-1 rounded-full text-white ${color}`}>{status}</span>;
    };

    if (loading) return <div className="text-center p-8">Loading Kitchen Display System...</div>;

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <header className="py-4 text-center bg-white rounded-lg shadow mb-6">
                <ChefHat className="w-8 h-8 mx-auto text-red-600" />
                <h1 className="text-3xl font-extrabold text-gray-900 mt-2">Stall Kitchen Display</h1>
                <p className="text-sm text-gray-500">Real-Time Orders from IIT-GN Customers</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map(order => {
                    const action = getNextActionButton(order);
                    const isNew = order.status === OrderStatus.NEW;

                    return (
                        <div
                            key={order.id}
                            className={`bg-white p-6 rounded-xl shadow-lg transition-all duration-300 ${isNew ? 'border-4 border-red-500 shadow-red-200' : 'border border-gray-200'}`}
                        >
                            {isNew && <audio autoPlay src="https://assets.mixkit.co/sfx/preview/mixkit-bell-notification-933.mp3"></audio>} {/* Simple notification sound for NEW orders */}

                            <div className="flex justify-between items-center border-b pb-3 mb-3">
                                <h2 className={`text-3xl font-extrabold ${isNew ? 'text-red-600' : 'text-gray-800'}`}>
                                    # {order.orderId}
                                </h2>
                                {getStatusBadge(order.status)}
                            </div>

                            <div className="space-y-2 mb-4">
                                {order.items.map((item, index) => (
                                    <div key={index} className="text-lg text-gray-700 border-b border-gray-100 pb-1">
                                        <p>
                                            <span className="font-bold mr-2">{item.quantity}x</span> {item.name}
                                            {item.price > (MENU_ITEMS.find(m => m.name === item.name)?.price || 0) && (
                                                <span className="ml-1 text-sm font-semibold text-green-600">({formatPrice(item.price)})</span>
                                            )}
                                        </p>
                                        {item.customizations && (
                                            <div className="mt-1 ml-4 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                                <p className="font-semibold mb-1">Ingredients:</p>
                                                <ul className="list-disc list-inside text-xs space-y-0.5">
                                                    {item.customizations.map(id => {
                                                        const ing = ALL_INGREDIENTS_FLAT.find(i => i.id === id);
                                                        return <li key={id}>{ing?.name} {ing?.price > 0 ? ` (+${formatPrice(ing.price)})` : ''}</li>;
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-dashed border-gray-300">
                                <span className="text-base font-semibold text-gray-600">Total:</span>
                                <span className="text-xl font-bold text-green-600">{formatPrice(order.total)}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Ordered at: {order.timestamp}</p>
                            <p className="text-xs text-gray-400 break-all mt-1">Customer ID: {order.userId}</p>

                            <button
                                onClick={() => updateStatus(order.id, order.status)}
                                disabled={action.disabled}
                                className={`mt-4 w-full py-3 px-4 text-white font-bold rounded-lg shadow-md transition duration-300 transform active:scale-95 ${action.color}`}
                            >
                                {action.text}
                            </button>
                        </div>
                    );
                })}

                {orders.length === 0 && (
                    <div className="col-span-full text-center p-10 bg-white rounded-xl shadow-md">
                        <p className="text-lg text-gray-500">No new orders at the moment. Waiting for customers...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Main App Component
const App = () => {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [view, setView] = useState('customer'); // 'customer' or 'stall'
    const [isStaffAuthenticated, setIsStaffAuthenticated] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const STAFF_PASSWORD = 'mamba123'; // centralize password

    // Firestore path for orders
    const orderCollectionPath = useMemo(() => `/artifacts/${appId}/public/data/orders`, [appId]);

    // 1. Initialize Firebase and Authenticate
    useEffect(() => {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            console.error("Firebase config is missing.");
            setAuthReady(true); // Allow UI to load even if auth fails
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const auth = getAuth(app);
            setDb(firestore);

            // Listen for auth state changes
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    // Sign in anonymously if no user is found
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (error) {
                        console.error("Firebase Auth Error:", error);
                    }
                }
                // Once auth is settled, set the user ID and readiness flag
                setUserId(auth.currentUser?.uid || crypto.randomUUID());
                setAuthReady(true);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Failed to initialize Firebase:", e);
            setAuthReady(true);
        }
    }, [initialAuthToken]);

    // 2. Simple URL check to switch to Stall View for staff
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');

        if (viewParam === 'stall') {
            const entered = prompt("🔐 Enter staff access password:");
            if (entered === STAFF_PASSWORD) {
                setIsStaffAuthenticated(true);
                setView('stall');
            } else {
                alert("❌ Access denied.");
                window.history.replaceState({}, document.title, "/"); // redirect back to customer view
            }
        }
    }, []);

    if (!authReady) {
        return (
            <div className="flex items-center justify-center min-h-screen text-gray-500">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting to ordering system...
            </div>
        );
    }

    return (
        <div className="font-sans">
            {/* View Toggle (Only visible if the user is not in the stall view and for easy testing) */}
            {view === 'customer' && (
                <button
                    onClick={() => {
                        const entered = prompt("🔐 Enter staff access password:");
                        if (entered === STAFF_PASSWORD) {
                            setIsStaffAuthenticated(true);
                            setView('stall');
                        } else {
                            alert("❌ Access denied.");
                        }
                    }}
                    className="fixed bottom-2 right-2 z-50 p-2 bg-green-500 text-black rounded-full shadow-lg text-xs hover:bg-green-600"
                    title="Switch to Staff View"
                >
                    Staff KDS
                </button>
            )}
             {view === 'stall' && (
                <button
                    onClick={() => {
                        // log out staff on switching back
                        setIsStaffAuthenticated(false);
                        setView('customer');
                    }}
                    className="fixed top-2 right-2 z-50 p-2 bg-pink-500 text-white rounded-full shadow-lg text-xs"
                    title="Switch to Customer View"
                >
                    Customer Order
                </button>
            )}

            {view === 'customer' ? (
                <CustomerView db={db} userId={userId} orderCollectionPath={orderCollectionPath} />
            ) : (
                // ensure stall view only shown when authenticated
                isStaffAuthenticated ? (
                    <StallView db={db} orderCollectionPath={orderCollectionPath} />
                ) : (
                    // fallback to customer if someone tries to set view without auth
                    <CustomerView db={db} userId={userId} orderCollectionPath={orderCollectionPath} />
                )
            )}
        </div>
    );
};

export default App;