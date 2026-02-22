import React, { useState, useEffect } from 'react';
// DestinationDetailScreen - manages expenses/balances/settlements for a single destination
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, Platform,
    useColorScheme, ActivityIndicator, Alert, Modal, TextInput, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';


const TabButton = ({ label, active, onPress, theme }) => (
    <TouchableOpacity
        style={[styles.tabBtn, active && { backgroundColor: COLORS.indigo + '20' }]}
        onPress={onPress}
    >
        <Text style={[styles.tabText, { color: theme.textSecondary }, active && { color: COLORS.indigo }]}>{label}</Text>
    </TouchableOpacity>
);

export default function DestinationDetailScreen({ navigation, route }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DARK : LIGHT;

    const { destination, tripId, tripData } = route.params;
    const trip = tripData; // trip-level data (travellers, etc.)
    const { user } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [activeTab, setActiveTab] = useState('Expenses');
    const [currentTrip, setCurrentTrip] = useState(trip);
    const [currentDest, setCurrentDest] = useState(destination);

    // Group Management State
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [travellerPayments, setTravellerPayments] = useState({});

    useEffect(() => {
        if (activeTab === 'Settle' && currentTrip?.travellerEmails?.length > 0) {
            const fetchPayments = async () => {
                try {
                    const q = query(
                        collection(db, 'users'),
                        where('email', 'in', currentTrip.travellerEmails.map(e => e.toLowerCase()))
                    );
                    const snap = await getDocs(q);
                    const payments = {};
                    snap.forEach(doc => {
                        const data = doc.data();
                        payments[data.email.toLowerCase()] = {
                            upiId: data.upiId || null,
                            paypalId: data.paypalId || null
                        };
                    });
                    setTravellerPayments(payments);
                } catch (error) {
                    console.error('Error fetching traveller payments:', error);
                }
            };
            fetchPayments();
        }
    }, [activeTab, currentTrip?.travellerEmails]);

    // Expense Modal State
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [expenseTitle, setExpenseTitle] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('🍔 Food');
    const [expenseCurrency, setExpenseCurrency] = useState(destination.baseCurrency || 'USD');
    const [splitWith, setSplitWith] = useState([]); // Array of traveller names
    const [splitType, setSplitType] = useState('equal'); // 'equal' | 'exact' | 'shares'
    const [splitAmounts, setSplitAmounts] = useState({}); // { name: amount } for exact, { name: shares } for shares
    const [isSavingExpense, setIsSavingExpense] = useState(false);
    const [liveRate, setLiveRate] = useState(null);

    const defaultCurrency = user?.defaultCurrency || 'USD';

    const openExpenseModal = () => {
        const myNickname = currentTrip.travellers?.find(t =>
            t.email && t.email.toLowerCase() === user.email?.toLowerCase()
        )?.name || user.displayName || 'You';

        setExpenseCurrency(defaultCurrency);
        setSplitWith([myNickname]);
        setSplitType('equal');
        setSplitAmounts({});
        setShowAddExpense(true);
    };

    useEffect(() => {
        if (route.params?.openAddExpense) {
            openExpenseModal();
            // Clear the param after opening to avoid re-opening on re-renders
            navigation.setParams({ openAddExpense: false });
        }
    }, [route.params?.openAddExpense]);

    useEffect(() => {
        if (!tripId || !destination?.id) return;

        // Trip Metadata Listener
        const tripRef = doc(db, 'trips', tripId);
        const unsubTrip = onSnapshot(tripRef, (snapshot) => {
            if (snapshot.exists()) {
                setCurrentTrip({ id: snapshot.id, ...snapshot.data() });
            }
        });

        // Destination Metadata Listener
        const destRef = doc(db, 'trips', tripId, 'destinations', destination.id);
        const unsubDest = onSnapshot(destRef, (snapshot) => {
            if (snapshot.exists()) {
                setCurrentDest({ id: snapshot.id, ...snapshot.data() });
            }
        });

        // Expenses Listener (under destination)
        const q = query(
            collection(db, 'trips', tripId, 'destinations', destination.id, 'expenses')
        );

        const unsubExpenses = onSnapshot(q, (snapshot) => {
            const expensesData = [];
            snapshot.forEach((doc) => {
                expensesData.push({ id: doc.id, ...doc.data() });
            });
            expensesData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setExpenses(expensesData);
        });

        return () => {
            unsubTrip();
            unsubDest();
            unsubExpenses();
        };
    }, [tripId, destination?.id]);

    useEffect(() => {
        const fetchLiveRate = async () => {
            if (!currentDest?.baseCurrency || currentDest.baseCurrency === defaultCurrency) {
                setLiveRate(null);
                return;
            }

            try {
                const res = await fetch(`https://api.frankfurter.app/latest?from=${defaultCurrency}&to=${currentDest.baseCurrency}`);
                if (!res.ok) {
                    setLiveRate(null);
                    return;
                }
                const data = await res.json();
                if (data.rates && data.rates[currentDest.baseCurrency]) {
                    setLiveRate(data.rates[currentDest.baseCurrency]);
                }
            } catch (err) {
                console.log('Detail rate fetch failed:', err);
                setLiveRate(null);
            }
        };

        fetchLiveRate();
    }, [currentDest?.baseCurrency, defaultCurrency]);

    const addTraveller = async () => {
        if (!newMemberName.trim()) return;
        try {
            const colors = [COLORS.red, COLORS.green, COLORS.orange, COLORS.violet, '#10B981', '#34D399', '#F59E0B'];
            const newTraveller = {
                name: newMemberName,
                email: newMemberEmail,
                color: colors[currentTrip.travellers.length % colors.length],
                letter: newMemberName.substring(0, 1).toUpperCase(),
                paymentModes: ['Cash']
            };

            const updateObj = {
                travellers: arrayUnion(newTraveller)
            };

            if (newMemberEmail) {
                updateObj.travellerEmails = arrayUnion(newMemberEmail.toLowerCase());
            }

            await updateDoc(doc(db, 'trips', tripId), updateObj);
            setNewMemberName('');
            setNewMemberEmail('');
            setShowAddMember(false);
        } catch (error) {
            console.error('Error adding traveller:', error);
            Alert.alert('Error', 'Failed to add traveller');
        }
    };

    const removeTraveller = async (traveller) => {
        const isMe = traveller.email && traveller.email.toLowerCase() === user.email?.toLowerCase();
        if (isMe) {
            Alert.alert('Error', 'You cannot remove yourself from the trip');
            return;
        }

        Alert.alert(
            'Remove Traveller',
            `Are you sure you want to remove ${traveller.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const updateObj = {
                                travellers: arrayRemove(traveller)
                            };
                            if (traveller.email) {
                                updateObj.travellerEmails = arrayRemove(traveller.email.toLowerCase());
                            }
                            await updateDoc(doc(db, 'trips', tripId), updateObj);
                        } catch (error) {
                            console.error('Error removing traveller:', error);
                        }
                    }
                }
            ]
        );
    };

    const openPaymentApp = (type, handle, amount, receiverName) => {
        if (type === 'UPI') {
            const upiUrl = `upi://pay?pa=${handle}&pn=${receiverName}&am=${amount}&cu=${currentDest.baseCurrency}&tn=BalanceBuddy: Settling ${currentDest.name}`;
            Linking.openURL(upiUrl).catch(() => {
                Alert.alert('Error', 'Could not open UPI apps. Make sure Google Pay, PhonePe or Paytm is installed.');
            });
        } else if (type === 'PayPal') {
            const paypalUrl = `https://www.paypal.me/${handle}/${amount}${currentDest.baseCurrency}`;
            Linking.openURL(paypalUrl).catch(() => {
                Alert.alert('Error', 'Could not open browser for PayPal.');
            });
        }
    };

    const addExpense = async () => {
        if (!expenseTitle.trim() || !expenseAmount) {
            Alert.alert('Error', 'Please enter title and amount');
            return;
        }
        if (splitWith.length === 0) {
            Alert.alert('Error', 'Please select at least one person to split with');
            return;
        }

        // Validate unequal splits
        const totalAmount = parseFloat(expenseAmount);
        if (splitType === 'exact') {
            const sumExact = splitWith.reduce((s, name) => s + (parseFloat(splitAmounts[name]) || 0), 0);
            if (Math.abs(sumExact - totalAmount) > 0.01) {
                Alert.alert('Split Error', `Exact amounts sum to ${sumExact.toFixed(2)} but total is ${totalAmount.toFixed(2)}. They must match.`);
                return;
            }
        }
        if (splitType === 'shares') {
            const totalShares = splitWith.reduce((s, name) => s + (parseFloat(splitAmounts[name]) || 0), 0);
            if (totalShares <= 0) {
                Alert.alert('Split Error', 'Total shares must be greater than zero.');
                return;
            }
        }

        setIsSavingExpense(true);
        try {
            let amount = totalAmount;
            let originalAmount = amount;
            let originalCurrency = expenseCurrency;

            // Convert to base currency if different
            if (expenseCurrency !== currentDest.baseCurrency && liveRate) {
                amount = amount * liveRate;
            }

            // Correctly identify the manual payer nickname based on who is logged in
            const myNickname = currentTrip.travellers?.find(t =>
                t.email && t.email.toLowerCase() === user.email?.toLowerCase()
            )?.name || user.displayName || 'You';

            // Build split data for storage
            const expenseData = {
                title: expenseTitle,
                amount: amount,
                originalAmount: originalAmount,
                originalCurrency: originalCurrency,
                category: expenseCategory,
                currency: currentDest.baseCurrency,
                splitWith: splitWith,
                splitType: splitType,
                paidBy: user.uid,
                paidByNickname: myNickname,
                createdAt: serverTimestamp(),
                icon: expenseCategory.split(' ')[0],
                color: COLORS.indigo
            };

            // Store split details for unequal splits
            if (splitType === 'exact') {
                // Convert exact amounts proportionally if currency conversion happened
                const conversionFactor = (expenseCurrency !== currentDest.baseCurrency && liveRate) ? liveRate : 1;
                const convertedSplitAmounts = {};
                splitWith.forEach(name => {
                    convertedSplitAmounts[name] = (parseFloat(splitAmounts[name]) || 0) * conversionFactor;
                });
                expenseData.splitAmounts = convertedSplitAmounts;
            } else if (splitType === 'shares') {
                expenseData.splitShares = {};
                splitWith.forEach(name => {
                    expenseData.splitShares[name] = parseFloat(splitAmounts[name]) || 1;
                });
            }

            await addDoc(collection(db, 'trips', tripId, 'destinations', destination.id, 'expenses'), expenseData);

            // Update totalSpent in destination doc
            await updateDoc(doc(db, 'trips', tripId, 'destinations', destination.id), {
                totalSpent: (currentDest.totalSpent || 0) + amount
            });

            setExpenseTitle('');
            setExpenseAmount('');
            setSplitWith([]);
            setSplitType('equal');
            setSplitAmounts({});
            setShowAddExpense(false);
            Alert.alert('Success', 'Expense added successfully');
        } catch (error) {
            console.error('Error adding expense:', error);
            Alert.alert('Error', 'Failed to save expense');
        } finally {
            setIsSavingExpense(false);
        }
    };

    const toggleSplit = (traveller) => {
        const name = traveller.name;
        const myNickname = currentTrip.travellers?.find(t =>
            t.email && t.email.toLowerCase() === user.email?.toLowerCase()
        )?.name || user.displayName || 'You';

        const isMe = name === myNickname;

        if (splitWith.includes(name)) {
            if (isMe) {
                Alert.alert('Note', 'You must be included in the split since you are adding this bill.');
                return;
            }
            setSplitWith(prev => prev.filter(n => n !== name));
        } else {
            setSplitWith(prev => [...prev, name]);
        }
    };

    const deleteExpense = async (expense) => {
        Alert.alert(
            'Delete Expense',
            'Are you sure you want to delete this expense?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'trips', tripId, 'destinations', destination.id, 'expenses', expense.id));
                            // Update totalSpent (downward)
                            await updateDoc(doc(db, 'trips', tripId, 'destinations', destination.id), {
                                totalSpent: (currentDest.totalSpent || 0) - (expense.amount || 0)
                            });
                        } catch (error) {
                            console.error('Error deleting expense:', error);
                            Alert.alert('Error', 'Failed to delete expense');
                        }
                    }
                }
            ]
        );
    };

    const deleteDestination = async () => {
        Alert.alert(
            'Delete Destination',
            'This will permanently delete this destination and all its expenses. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'trips', tripId, 'destinations', destination.id));
                            navigation.goBack();
                        } catch (error) {
                            console.error('Error deleting destination:', error);
                            Alert.alert('Error', 'Failed to delete destination');
                        }
                    }
                }
            ]
        );
    };


    const recordSettlement = async (s) => {
        Alert.alert(
            'Record Settlement',
            `Has ${s.from} paid ${currentDest.baseCurrency} ${s.amount.toFixed(2)} to ${s.to}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm & Settle',
                    onPress: async () => {
                        try {
                            setIsSavingExpense(true);
                            await addDoc(collection(db, 'trips', tripId, 'destinations', destination.id, 'expenses'), {
                                title: `Settlement: ${s.from} ➔ ${s.to}`,
                                amount: s.amount,
                                category: '💰 Settlement',
                                currency: currentDest.baseCurrency,
                                splitWith: [s.to],
                                paidByNickname: s.from,
                                isSettlement: true,
                                createdAt: serverTimestamp(),
                                icon: '💰',
                                color: COLORS.greenLight
                            });
                            Alert.alert('Success', 'Payment recorded! Balances have been updated.');
                        } catch (error) {
                            console.error('Error recording settlement:', error);
                            Alert.alert('Error', 'Failed to record settlement');
                        } finally {
                            setIsSavingExpense(false);
                        }
                    }
                }
            ]
        );
    };

    // deleteTrip removed - handled at trip level now

    const handleFabPress = () => {
        if (activeTab === 'Group') {
            setShowAddMember(true);
        } else {
            openExpenseModal();
        }
    };

    // ── Splitting Engine ──────────────────────────────────────────────────────
    // Helper: compute per-person share for an expense
    const getPerPersonShares = (expense) => {
        const { amount, splitWith: sw, splitType: st, splitAmounts: sa, splitShares: ss } = expense;
        if (!amount || !sw || sw.length === 0) return {};

        const shares = {};
        if (st === 'exact' && sa) {
            // Exact amounts per person (already in base currency)
            sw.forEach(name => { shares[name] = sa[name] || 0; });
        } else if (st === 'shares' && ss) {
            // Proportional shares
            const totalShares = sw.reduce((s, name) => s + (ss[name] || 1), 0);
            sw.forEach(name => {
                shares[name] = totalShares > 0 ? (amount * (ss[name] || 1)) / totalShares : 0;
            });
        } else {
            // Equal split (default / legacy)
            const perHead = amount / sw.length;
            sw.forEach(name => { shares[name] = perHead; });
        }
        return shares;
    };

    // Build net balance map: { name -> net (positive = owed money back, negative = owes money) }
    const computeBalances = () => {
        const travellers = currentTrip.travellers || [];
        const balances = {}; // name -> net amount
        travellers.forEach(t => { balances[t.name] = 0; });

        expenses.forEach(expense => {
            const { amount, paidByNickname } = expense;
            if (!amount) return;

            const shares = getPerPersonShares(expense);

            // Payer gets credited (net positive)
            if (balances.hasOwnProperty(paidByNickname)) {
                balances[paidByNickname] += amount;
            }
            // Each participant owes their share
            Object.entries(shares).forEach(([name, share]) => {
                if (balances.hasOwnProperty(name)) {
                    balances[name] -= share;
                }
            });
        });
        return balances;
    };

    // Greedy debt minimization: returns [{from, to, amount}]
    const computeSettlements = () => {
        const balances = computeBalances();
        // Separate into creditors (owed money) and debtors (owe money)
        const creditors = []; // { name, amount }
        const debtors = [];   // { name, amount }
        Object.entries(balances).forEach(([name, net]) => {
            if (net > 0.005) creditors.push({ name, amount: net });
            else if (net < -0.005) debtors.push({ name, amount: -net });
        });

        const settlements = [];
        // Sort descending so we match biggest first
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        let ci = 0, di = 0;
        while (ci < creditors.length && di < debtors.length) {
            const credit = creditors[ci];
            const debt = debtors[di];
            const settled = Math.min(credit.amount, debt.amount);
            settlements.push({ from: debt.name, to: credit.name, amount: settled });
            credit.amount -= settled;
            debt.amount -= settled;
            if (credit.amount < 0.005) ci++;
            if (debt.amount < 0.005) di++;
        }
        return settlements;
    };

    const balances = computeBalances();
    const settlements = computeSettlements();

    const totalSpentInBase = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const myNickname = currentTrip.travellers?.find(t =>
        t.email && t.email.toLowerCase() === user.email?.toLowerCase()
    )?.name || user.displayName || 'You';
    const myBalanceInBase = balances[myNickname] || 0;

    const baseCurrency = currentDest?.baseCurrency || 'USD';

    const displayTotalContent = (!liveRate || baseCurrency === defaultCurrency)
        ? { amount: totalSpentInBase, currency: baseCurrency }
        : { amount: totalSpentInBase / liveRate, currency: defaultCurrency };

    const displayBalanceContent = (!liveRate || baseCurrency === defaultCurrency)
        ? { amount: myBalanceInBase, currency: baseCurrency }
        : { amount: myBalanceInBase / liveRate, currency: defaultCurrency };


    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" translucent />

            {/* Header / Backdrop */}
            <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.backdrop}>
                <View style={styles.headerNav}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerRight}>
                        <TouchableOpacity style={styles.circleBtn} onPress={deleteDestination}>
                            <Ionicons name="trash-outline" size={20} color="#F43F5E" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.tripHeader}>
                    <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']} style={styles.tripIcon}>
                        <Ionicons name="location" size={28} color="#fff" />
                    </LinearGradient>
                    <View>
                        <Text style={styles.tripName}>{currentDest?.name || destination.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.tripLocation}>{baseCurrency} · {currentTrip?.name}</Text>
                            {liveRate && (
                                <View style={styles.rateBadge}>
                                    <Text style={styles.rateBadgeText}>1 {defaultCurrency} ≈ {liveRate.toFixed(2)} {baseCurrency}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>TOTAL SPENT</Text>
                        <Text style={styles.statValue}>{displayTotalContent.currency} {displayTotalContent.amount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>YOUR BAL</Text>
                        <Text style={[styles.statValue, { color: displayBalanceContent.amount >= -0.005 ? '#10B981' : '#EF4444' }]}>
                            {displayBalanceContent.amount >= -0.005 ? '+' : ''}{displayBalanceContent.currency} {displayBalanceContent.amount.toFixed(2)}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.statItem}
                        onPress={() => setActiveTab('Group')}
                    >
                        <Text style={styles.statLabel}>TRAVELLERS</Text>
                        <View style={styles.miniAvatars}>
                            {currentTrip.travellers?.slice(0, 3).map((t, i) => (
                                <View
                                    key={i}
                                    style={[styles.miniAvatar, { backgroundColor: t.color || COLORS.violet, marginLeft: i > 0 ? -8 : 0 }]}
                                >
                                    <Text style={styles.miniAvatarText}>{t.letter}</Text>
                                </View>
                            ))}
                            {currentTrip.travellers?.length > 3 && (
                                <View style={[styles.miniAvatar, { backgroundColor: '#374151', marginLeft: -8 }]}>
                                    <Text style={styles.miniAvatarText}>+{currentTrip.travellers.length - 3}</Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Background Decoration */}
                <View style={[styles.bubble, { top: 50, right: -60, backgroundColor: COLORS.purpleBubble }]} />
                <View style={[styles.bubble, { top: 400, left: -80, width: 280, height: 280, backgroundColor: COLORS.cyanBubble }]} />

                {/* Budget Progress */}
                {(currentDest.budget > 0) && (
                    <View style={[styles.budgetSection, { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
                        <View style={styles.budgetHeader}>
                            <View style={styles.budgetTitleRow}>
                                <MaterialCommunityIcons name="finance" size={16} color={COLORS.indigo} />
                                <Text style={[styles.budgetTitle, { color: theme.textSecondary }]}>BUDGET PROGRESS</Text>
                            </View>
                            <Text style={styles.budgetPercent}>{Math.round((totalSpentInBase / (currentDest.budget || 1)) * 100)}%</Text>
                        </View>
                        <View style={[styles.budgetBarBg, { backgroundColor: theme.border }]}>
                            <View style={[styles.budgetBarFill, { width: `${Math.min((totalSpentInBase / (currentDest.budget || 1)) * 100, 100)}%` }]} />
                        </View>
                        <Text style={[styles.budgetRemaining, { color: theme.textMuted }]}>
                            Remaining: {displayTotalContent.currency} {((currentDest.budget - totalSpentInBase) / (displayTotalContent.currency === baseCurrency ? 1 : liveRate)).toFixed(2)}
                        </Text>
                    </View>
                )}

                {/* Tabs */}
                <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
                    <TabButton label="Expenses" active={activeTab === 'Expenses'} onPress={() => setActiveTab('Expenses')} theme={theme} />
                    <TabButton label="Balances" active={activeTab === 'Balances'} onPress={() => setActiveTab('Balances')} theme={theme} />
                    <TabButton label="Settle" active={activeTab === 'Settle'} onPress={() => setActiveTab('Settle')} theme={theme} />
                    <TabButton label="Group" active={activeTab === 'Group'} onPress={() => setActiveTab('Group')} theme={theme} />
                </View>

                {/* List Content */}
                {activeTab === 'Expenses' && (
                    <>
                        {expenses.length > 0 ? (
                            expenses.map((expense, idx) => (
                                <View key={expense.id} style={[styles.expenseCard, { backgroundColor: 'rgba(15, 23, 42, 0.65)', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
                                    <View style={[styles.expenseIcon, { backgroundColor: expense.color || '#38BDF8' }]}>
                                        {expense.icon && expense.icon.match(/\p{Emoji}/u) ? (
                                            <Text style={{ fontSize: 18 }}>{expense.icon}</Text>
                                        ) : (
                                            <Ionicons name={expense.icon || 'receipt-outline'} size={20} color="#fff" />
                                        )}
                                    </View>
                                    <View style={styles.expenseInfo}>
                                        <Text style={[styles.expenseTitle, { color: theme.textPrimary }]}>{expense.title}</Text>
                                        <Text style={[styles.expenseMeta, { color: theme.textMuted }]}>Paid by {expense.paidByNickname || 'Someone'}</Text>
                                    </View>
                                    <View style={styles.expenseAmountCol}>
                                        {/* Primary: show in user's default currency */}
                                        <Text style={[styles.expenseAmount, { color: theme.textPrimary }]}>
                                            {defaultCurrency} {(liveRate && baseCurrency !== defaultCurrency
                                                ? expense.amount / liveRate
                                                : expense.amount
                                            ).toFixed(2)}
                                        </Text>
                                        {/* Secondary: show destination base currency if different from default */}
                                        {baseCurrency !== defaultCurrency && (
                                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textAlign: 'right' }}>
                                                {baseCurrency} {expense.amount.toFixed(2)}
                                            </Text>
                                        )}
                                        {/* Show original expense currency if different from both */}
                                        {expense.originalCurrency && expense.originalCurrency !== baseCurrency && expense.originalCurrency !== defaultCurrency && (
                                            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'right' }}>
                                                {expense.originalCurrency} {expense.originalAmount?.toFixed(2)}
                                            </Text>
                                        )}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                            <Text style={[styles.expenseDate, { color: theme.textMuted }]}>Today</Text>
                                            {(expense.paidBy === user.uid || currentTrip.creatorId === user.uid) && (
                                                <TouchableOpacity onPress={() => deleteExpense(expense)}>
                                                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="file-document-outline" size={48} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textPrimary }]}>No expenses yet</Text>
                                <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>Tap + to add your first expense</Text>
                            </View>
                        )}

                    </>
                )}

                {/* ── BALANCES TAB ─────────────────────────────────────── */}
                {
                    activeTab === 'Balances' && (
                        <View style={styles.balancesContainer}>
                            {/* Summary header */}
                            <View style={styles.ledgerHeader}>
                                <Ionicons name="bar-chart-outline" size={16} color="#38BDF8" />
                                <Text style={styles.ledgerTitle}>WHO PAID WHAT</Text>
                            </View>

                            {expenses.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons name="scale-balance" size={48} color={theme.textMuted} />
                                    <Text style={[styles.emptyText, { color: theme.textPrimary }]}>No expenses yet</Text>
                                    <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>Add expenses to see the ledger</Text>
                                </View>
                            ) : (
                                <>
                                    {/* Per-expense breakdown */}
                                    {expenses.map((expense) => {
                                        const sw = expense.splitWith || [];
                                        const shares = getPerPersonShares(expense);
                                        const isUnequal = expense.splitType === 'exact' || expense.splitType === 'shares';
                                        return (
                                            <View key={expense.id} style={styles.ledgerCard}>
                                                <View style={styles.ledgerCardHeader}>
                                                    <View style={styles.ledgerIconWrap}>
                                                        {expense.icon && expense.icon.match(/\p{Emoji}/u) ? (
                                                            <Text style={{ fontSize: 16 }}>{expense.icon}</Text>
                                                        ) : (
                                                            <Ionicons name={expense.icon || 'receipt-outline'} size={16} color="#38BDF8" />
                                                        )}
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.ledgerCardTitle}>{expense.title}</Text>
                                                        <Text style={styles.ledgerCardMeta}>
                                                            {expense.category} · {sw.length} people{isUnequal ? ` · ${expense.splitType === 'exact' ? 'Exact' : 'Shares'}` : ''}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.ledgerAmountBadge}>
                                                        <Text style={styles.ledgerAmountText}>{currentTrip.baseCurrency} {expense.amount.toFixed(2)}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.ledgerDivider} />
                                                <View style={styles.ledgerPaidRow}>
                                                    <Text style={styles.ledgerPaidBy}>💳 {expense.paidByNickname || 'Someone'} paid</Text>
                                                    {!isUnequal && (
                                                        <Text style={styles.ledgerPerHead}>{currentTrip.baseCurrency} {(sw.length > 0 ? expense.amount / sw.length : 0).toFixed(2)}/person</Text>
                                                    )}
                                                </View>
                                                <View style={styles.ledgerParticipants}>
                                                    {sw.map((name, ni) => (
                                                        <View key={ni} style={styles.participantChip}>
                                                            <Text style={styles.participantChipText}>
                                                                {name}{isUnequal ? ` · ${currentTrip.baseCurrency} ${(shares[name] || 0).toFixed(2)}` : ''}
                                                            </Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        );
                                    })}

                                    {/* Net balance summary */}
                                    <View style={[styles.ledgerHeader, { marginTop: 20 }]}>
                                        <Ionicons name="wallet-outline" size={16} color="#A78BFA" />
                                        <Text style={styles.ledgerTitle}>NET BALANCES</Text>
                                    </View>
                                    {Object.entries(balances).map(([name, net]) => {
                                        const isSettled = Math.abs(net) < 0.01;
                                        const isCreditor = net >= 0.005; // Use 0.005 to treat near-zero as positive

                                        let statusColor = isSettled ? '#94A3B8' : (isCreditor ? '#10B981' : '#EF4444');
                                        let statusLabel = isSettled ? 'settled' : (isCreditor ? 'gets back' : 'owes');
                                        let amountStr = isSettled ? '0.00' : Math.abs(net).toFixed(2);
                                        let prefix = isCreditor ? '+' : (isSettled ? '+' : '-');

                                        return (
                                            <View key={name} style={styles.netBalanceRow}>
                                                <View style={[styles.netAvatar, { backgroundColor: (currentTrip.travellers?.find(t => t.name === name)?.color) || '#38BDF8' }]}>
                                                    <Text style={styles.netAvatarLetter}>{name[0]}</Text>
                                                </View>
                                                <Text style={styles.netName}>{name}</Text>
                                                <Text style={[styles.netAmount, { color: statusColor }]}>
                                                    {prefix}{currentTrip.baseCurrency} {amountStr}
                                                </Text>
                                                <Text style={[styles.netLabel, { color: statusColor }]}>
                                                    {statusLabel}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </>
                            )}
                        </View>
                    )
                }

                {/* ── SETTLE TAB ───────────────────────────────────────── */}
                {
                    activeTab === 'Settle' && (
                        <View style={styles.balancesContainer}>
                            <View style={styles.ledgerHeader}>
                                <Ionicons name="checkmark-done-circle-outline" size={16} color="#10B981" />
                                <Text style={styles.ledgerTitle}>OPTIMAL SETTLEMENT PLAN</Text>
                            </View>
                            <Text style={styles.settleSubtitle}>
                                Minimum {settlements.length} transaction{settlements.length !== 1 ? 's' : ''} needed to fully settle debts
                            </Text>

                            {settlements.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="checkmark-circle-outline" size={56} color="#10B981" />
                                    <Text style={[styles.emptyText, { color: theme.textPrimary }]}>
                                        {expenses.length === 0 ? 'No expenses yet' : 'All settled up! 🎉'}
                                    </Text>
                                    <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
                                        {expenses.length === 0 ? 'Add expenses to compute settlements' : 'Everyone is even'}
                                    </Text>
                                </View>
                            ) : (
                                settlements.map((s, i) => {
                                    // Find my nickname in this trip
                                    const userNickname = currentTrip.travellers?.find(t =>
                                        t.email && t.email.toLowerCase() === user.email?.toLowerCase()
                                    )?.name || 'You';

                                    const isPayer = s.from === userNickname || s.from === 'You';
                                    const isReceiver = s.to === userNickname || s.to === 'You';

                                    return (
                                        <View key={i} style={styles.settlementCard}>
                                            <View style={styles.settlementRow}>
                                                <View style={styles.settlementPerson}>
                                                    <View style={[styles.settleAvatar, { backgroundColor: (currentTrip.travellers?.find(t => t.name === s.from)?.color) || '#EF4444' }]}>
                                                        <Text style={styles.settleAvatarLetter}>{s.from[0]}</Text>
                                                    </View>
                                                    <Text style={styles.settleName}>{s.from}</Text>
                                                </View>
                                                <View style={styles.settleArrowWrap}>
                                                    <Text style={styles.settleAmount}>{currentTrip.baseCurrency} {s.amount.toFixed(2)}</Text>
                                                    {defaultCurrency !== currentTrip.baseCurrency && liveRate && (
                                                        <Text style={styles.convertedAmount}>
                                                            ≈ {defaultCurrency} {(s.amount / liveRate).toFixed(2)}
                                                        </Text>
                                                    )}
                                                    <Ionicons name="arrow-forward" size={18} color="#38BDF8" style={{ marginTop: 4 }} />
                                                </View>
                                                <View style={styles.settlementPerson}>
                                                    <View style={[styles.settleAvatar, { backgroundColor: (currentTrip.travellers?.find(t => t.name === s.to)?.color) || '#10B981' }]}>
                                                        <Text style={styles.settleAvatarLetter}>{s.to[0]}</Text>
                                                    </View>
                                                    <Text style={styles.settleName}>{s.to}</Text>
                                                </View>
                                            </View>

                                            {(isPayer || isReceiver) && (
                                                <View style={styles.settleActions}>
                                                    {isPayer && (() => {
                                                        const receiverEmail = currentTrip.travellers?.find(t => t.name === s.to)?.email?.toLowerCase();
                                                        const handles = travellerPayments[receiverEmail];
                                                        if (!handles) return null;

                                                        return (
                                                            <View style={styles.magicPayRow}>
                                                                {handles.upiId && (
                                                                    <TouchableOpacity
                                                                        style={[styles.magicBtn, { backgroundColor: '#F59E0B' }]}
                                                                        onPress={() => openPaymentApp('UPI', handles.upiId, s.amount, s.to)}
                                                                    >
                                                                        <Ionicons name="flash" size={14} color="#fff" />
                                                                        <Text style={styles.magicBtnText}>UPI</Text>
                                                                    </TouchableOpacity>
                                                                )}
                                                                {handles.paypalId && (
                                                                    <TouchableOpacity
                                                                        style={[styles.magicBtn, { backgroundColor: '#0070BA' }]}
                                                                        onPress={() => openPaymentApp('PayPal', handles.paypalId, s.amount, s.to)}
                                                                    >
                                                                        <Ionicons name="logo-paypal" size={14} color="#fff" />
                                                                        <Text style={styles.magicBtnText}>PayPal</Text>
                                                                    </TouchableOpacity>
                                                                )}
                                                            </View>
                                                        );
                                                    })()}

                                                    <TouchableOpacity
                                                        style={[styles.settleActionBtn, isPayer && { backgroundColor: COLORS.indigo }]}
                                                        onPress={() => recordSettlement(s)}
                                                    >
                                                        <Ionicons name={isReceiver ? "cash-outline" : "checkmark-circle-outline"} size={18} color="#fff" />
                                                        <Text style={styles.settleActionText}>
                                                            {isReceiver ? 'Mark as Received' : 'I have Paid'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )
                }

                {
                    activeTab === 'Group' && (
                        <View style={styles.groupContainer}>
                            <View style={styles.groupHeader}>
                                <Text style={styles.groupTitle}>Trip Members</Text>
                                <TouchableOpacity
                                    style={styles.addMemberBtn}
                                    onPress={() => setShowAddMember(true)}
                                >
                                    <Ionicons name="person-add-outline" size={20} color="#0EA5E9" />
                                    <Text style={styles.addMemberText}>Add Member</Text>
                                </TouchableOpacity>
                            </View>

                            {currentTrip.travellers?.map((t, i) => {
                                const isMe = t.email && t.email.toLowerCase() === user.email?.toLowerCase();
                                return (
                                    <View key={i} style={styles.travellerCard}>
                                        <View style={[styles.travellerAvatarLarge, { backgroundColor: t.color || '#38BDF8' }]}>
                                            <Text style={styles.travellerLetterLarge}>{t.letter}</Text>
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 16 }}>
                                            <Text style={styles.travellerName}>{t.name} {isMe ? '(You)' : ''}</Text>
                                            <Text style={styles.travellerEmail}>{t.email || 'No email'}</Text>
                                        </View>
                                        {!isMe && (
                                            <TouchableOpacity onPress={() => removeTraveller(t)}>
                                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )
                }
            </ScrollView>

            {/* Dynamic FAB */}
            {
                (activeTab === 'Expenses' || activeTab === 'Group') && (
                    <View style={styles.fabContainer}>
                        <TouchableOpacity style={styles.mainFab} onPress={handleFabPress} activeOpacity={0.9}>
                            <LinearGradient
                                colors={activeTab === 'Group' ? ['#6366F1', '#A855F7'] : ['#0EA5E9', '#2DD4BF']}
                                style={styles.mainFabGradient}
                            >
                                <Ionicons
                                    name={activeTab === 'Group' ? "person-add" : "receipt-outline"}
                                    size={26}
                                    color="#fff"
                                />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Add Member Modal */}
            <Modal visible={showAddMember} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Trip Member</Text>
                            <TouchableOpacity onPress={() => setShowAddMember(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>NAME</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter full name"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={newMemberName}
                                    onChangeText={setNewMemberName}
                                />
                            </View>
                        </View>

                        <View style={[styles.inputGroup, { marginTop: 20 }]}>
                            <Text style={styles.inputLabel}>EMAIL (OPTIONAL)</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.4)" />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter email address"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={newMemberEmail}
                                    onChangeText={setNewMemberEmail}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, !newMemberName.trim() && { opacity: 0.5 }]}
                            onPress={addTraveller}
                            disabled={!newMemberName.trim()}
                        >
                            <LinearGradient colors={['#0EA5E9', '#2DD4BF']} style={styles.submitGradient}>
                                <Text style={styles.submitBtnText}>Add to Group</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/* Add Expense Modal */}
            <Modal visible={showAddExpense} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Bill</Text>
                            <TouchableOpacity onPress={() => setShowAddExpense(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>BILL TITLE</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="document-text-outline" size={18} color="rgba(255,255,255,0.4)" />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="What was it for?"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        value={expenseTitle}
                                        onChangeText={setExpenseTitle}
                                    />
                                </View>
                            </View>

                            <View style={[styles.inputGroup, { marginTop: 15 }]}>
                                <Text style={styles.inputLabel}>AMOUNT & CURRENCY</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={[styles.inputWrapper, { flex: 2, paddingHorizontal: 12 }]}>
                                        <TextInput
                                            style={[styles.textInput, { marginLeft: 0 }]}
                                            placeholder="0.00"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                            keyboardType="numeric"
                                            value={expenseAmount}
                                            onChangeText={setExpenseAmount}
                                        />
                                    </View>
                                    <View style={[styles.inputWrapper, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                                        <Text style={{ color: '#fff', fontWeight: '800' }}>{expenseCurrency}</Text>
                                    </View>
                                </View>
                                {expenseCurrency !== currentTrip.baseCurrency && expenseAmount && liveRate && (
                                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, marginLeft: 4 }}>
                                        ≈ {currentTrip.baseCurrency} {(parseFloat(expenseAmount) * liveRate).toFixed(2)} (Converted)
                                    </Text>
                                )}
                            </View>

                            <View style={[styles.inputGroup, { marginTop: 15 }]}>
                                <Text style={styles.inputLabel}>CATEGORY</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                    {['🍔 Food', '🏨 Hotel', '✈️ Transport', '🎭 Activity', '🛍️ Shopping', '📦 Others'].map(cat => (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.categoryChip, expenseCategory === cat && styles.categoryChipActive]}
                                            onPress={() => setExpenseCategory(cat)}
                                        >
                                            <Text style={[styles.categoryChipText, expenseCategory === cat && { color: '#fff' }]}>{cat}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={[styles.inputGroup, { marginTop: 20 }]}>
                                <Text style={styles.inputLabel}>SPLIT TYPE</Text>
                                <View style={styles.splitTypeRow}>
                                    {[{ key: 'equal', label: '= Equal', icon: 'git-compare-outline' },
                                    { key: 'exact', label: '# Exact', icon: 'calculator-outline' },
                                    { key: 'shares', label: '⚖ Shares', icon: 'pie-chart-outline' }].map(opt => (
                                        <TouchableOpacity
                                            key={opt.key}
                                            style={[styles.splitTypeBtn, splitType === opt.key && styles.splitTypeBtnActive]}
                                            onPress={() => {
                                                setSplitType(opt.key);
                                                if (opt.key === 'equal') {
                                                    setSplitAmounts({});
                                                } else if (opt.key === 'shares') {
                                                    // Default 1 share per person
                                                    const defaults = {};
                                                    splitWith.forEach(n => { defaults[n] = '1'; });
                                                    setSplitAmounts(defaults);
                                                } else {
                                                    // Exact: blank
                                                    const defaults = {};
                                                    splitWith.forEach(n => { defaults[n] = ''; });
                                                    setSplitAmounts(defaults);
                                                }
                                            }}
                                        >
                                            <Text style={[styles.splitTypeBtnText, splitType === opt.key && styles.splitTypeBtnTextActive]}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={[styles.inputGroup, { marginTop: 20 }]}>
                                <Text style={styles.inputLabel}>SPLIT WITH</Text>
                                <View style={styles.friendList}>
                                    {currentTrip.travellers?.map((traveller, idx) => {
                                        const isMe = traveller.email && traveller.email.toLowerCase() === user.email?.toLowerCase();
                                        const isSelected = splitWith.includes(traveller.name);
                                        return (
                                            <View key={idx}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.friendItem,
                                                        isSelected && styles.friendItemActive,
                                                        isMe && { opacity: 0.8 }
                                                    ]}
                                                    onPress={() => {
                                                        toggleSplit(traveller);
                                                        // Initialize split amount for new selections in unequal mode
                                                        if (!isSelected && splitType !== 'equal') {
                                                            setSplitAmounts(prev => ({ ...prev, [traveller.name]: splitType === 'shares' ? '1' : '' }));
                                                        }
                                                    }}
                                                >
                                                    <View style={[styles.friendAvatar, { backgroundColor: traveller.color }]}>
                                                        <Text style={styles.friendLetter}>{traveller.letter}</Text>
                                                    </View>
                                                    <Text style={styles.friendName}>{traveller.name} {isMe ? '(You)' : ''}</Text>
                                                    {splitType === 'equal' && isSelected && expenseAmount ? (
                                                        <Text style={styles.splitPreviewAmount}>
                                                            {(parseFloat(expenseAmount) / splitWith.length).toFixed(2)}
                                                        </Text>
                                                    ) : null}
                                                    <Ionicons
                                                        name={isSelected ? "checkbox" : "square-outline"}
                                                        size={20}
                                                        color={isMe ? COLORS.indigo : (isSelected ? COLORS.indigo : "rgba(255,255,255,0.2)")}
                                                    />
                                                </TouchableOpacity>
                                                {/* Unequal split input row */}
                                                {isSelected && splitType !== 'equal' && (
                                                    <View style={styles.splitInputRow}>
                                                        <Text style={styles.splitInputLabel}>
                                                            {splitType === 'exact' ? 'Amount:' : 'Shares:'}
                                                        </Text>
                                                        <View style={styles.splitInputWrapper}>
                                                            <TextInput
                                                                style={styles.splitInput}
                                                                placeholder={splitType === 'exact' ? '0.00' : '1'}
                                                                placeholderTextColor="rgba(255,255,255,0.2)"
                                                                keyboardType="numeric"
                                                                value={String(splitAmounts[traveller.name] || '')}
                                                                onChangeText={(val) => {
                                                                    setSplitAmounts(prev => ({ ...prev, [traveller.name]: val }));
                                                                }}
                                                            />
                                                        </View>
                                                        {splitType === 'shares' && expenseAmount && splitWith.length > 0 && (
                                                            <Text style={styles.splitComputedAmount}>
                                                                = {(() => {
                                                                    const totalShares = splitWith.reduce((s, n) => s + (parseFloat(splitAmounts[n]) || 0), 0);
                                                                    const myShares = parseFloat(splitAmounts[traveller.name]) || 0;
                                                                    return totalShares > 0 ? ((parseFloat(expenseAmount) * myShares) / totalShares).toFixed(2) : '0.00';
                                                                })()}
                                                            </Text>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>

                                {/* Split summary */}
                                {splitType === 'exact' && expenseAmount && splitWith.length > 0 && (
                                    <View style={styles.splitSummary}>
                                        {(() => {
                                            const sumExact = splitWith.reduce((s, name) => s + (parseFloat(splitAmounts[name]) || 0), 0);
                                            const total = parseFloat(expenseAmount) || 0;
                                            const remaining = total - sumExact;
                                            const isBalanced = Math.abs(remaining) < 0.01;
                                            return (
                                                <Text style={[styles.splitSummaryText, { color: isBalanced ? '#10B981' : '#EF4444' }]}>
                                                    {isBalanced ? '✓ Amounts match total' : `${remaining > 0 ? `${remaining.toFixed(2)} left to assign` : `${Math.abs(remaining).toFixed(2)} over total`}`}
                                                </Text>
                                            );
                                        })()}
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, (!expenseTitle.trim() || !expenseAmount || isSavingExpense) && { opacity: 0.5 }]}
                                onPress={addExpense}
                                disabled={!expenseTitle.trim() || !expenseAmount || isSavingExpense}
                            >
                                <LinearGradient colors={['#EC4899', '#A855F7']} style={styles.submitGradient}>
                                    {isSavingExpense ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Expense</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    bubble: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        zIndex: 0,
        opacity: 0.15,
    },
    backdrop: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerRight: { flexDirection: 'row', gap: 10 },
    circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    tripHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 25 },
    tripIcon: { width: 64, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    tripName: { color: '#fff', fontSize: 24, fontWeight: '800' },
    tripLocation: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
    statsRow: { flexDirection: 'row', gap: 10 },
    statItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800', marginBottom: 4 },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
    miniAvatars: { flexDirection: 'row', alignItems: 'center' },
    miniAvatar: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#7C3AED' },
    miniAvatarText: { color: '#fff', fontSize: 8, fontWeight: '800' },
    content: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    budgetSection: { borderRadius: 16, padding: 16, marginBottom: 25, borderWidth: 1 },
    budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    budgetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    budgetTitle: { fontSize: 11, fontWeight: '800' },
    budgetPercent: { color: COLORS.indigo, fontSize: 11, fontWeight: '800' },
    budgetBarBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
    budgetBarFill: { height: '100%', backgroundColor: COLORS.indigo, borderRadius: 3 },
    budgetRemaining: { fontSize: 11, textAlign: 'right' },
    tabContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 25 },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    tabText: { fontSize: 12, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, fontWeight: '700', marginTop: 15 },
    emptySubtext: { fontSize: 13, marginTop: 4 },
    fabContainer: { position: 'absolute', bottom: 30, alignSelf: 'center', alignItems: 'center' },
    mainFab: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', elevation: 10 },
    mainFabGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    fabSubBtnWrapper: { position: 'absolute', width: 44, height: 44 },
    fabSubBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    expenseCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
    expenseIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    expenseInfo: { flex: 1 },
    expenseTitle: { fontSize: 15, fontWeight: '700' },
    expenseMeta: { fontSize: 12, marginTop: 4 },
    expenseAmountCol: { alignItems: 'flex-end' },
    expenseAmount: { fontSize: 15, fontWeight: '800' },
    expenseDate: { fontSize: 11, marginTop: 4 },

    // Group Tab Styles
    groupContainer: { paddingBottom: 20 },
    groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    groupTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
    addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(14, 165, 233, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    addMemberText: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
    travellerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    travellerAvatarLarge: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    travellerLetterLarge: { color: '#fff', fontSize: 18, fontWeight: '800' },
    travellerName: { color: '#fff', fontSize: 16, fontWeight: '700' },
    travellerEmail: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1E293B', width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    inputGroup: { width: '100%' },
    inputLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, paddingHorizontal: 12, height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    textInput: { flex: 1, color: '#fff', fontSize: 15, marginLeft: 10 },
    submitBtn: { height: 54, borderRadius: 16, overflow: 'hidden', marginTop: 30 },
    submitGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    // Expense Modal specific
    categoryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    categoryChipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
    categoryChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
    friendList: { marginTop: 10, gap: 10 },
    friendItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    friendItemActive: { borderColor: COLORS.indigo + '50', backgroundColor: COLORS.indigo + '10' },
    friendAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    friendLetter: { color: '#fff', fontSize: 12, fontWeight: '800' },
    friendName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
    splitPreviewAmount: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', marginRight: 8 },

    // Split Type Toggle
    splitTypeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    splitTypeBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
    },
    splitTypeBtnActive: { backgroundColor: COLORS.indigo + '20', borderColor: COLORS.indigo },
    splitTypeBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' },
    splitTypeBtnTextActive: { color: '#A78BFA' },

    // Unequal Split Inputs
    splitInputRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingLeft: 54, paddingRight: 10, paddingVertical: 6,
        marginTop: -2, backgroundColor: 'rgba(99,102,241,0.04)',
        borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    },
    splitInputLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700', width: 55 },
    splitInputWrapper: {
        flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8,
        paddingHorizontal: 10, height: 34, justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
    },
    splitInput: { color: '#fff', fontSize: 14, fontWeight: '700', padding: 0 },
    splitComputedAmount: { color: '#38BDF8', fontSize: 12, fontWeight: '700', minWidth: 60, textAlign: 'right' },
    splitSummary: {
        marginTop: 10, paddingVertical: 8, paddingHorizontal: 12,
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, alignItems: 'center',
    },
    splitSummaryText: { fontSize: 12, fontWeight: '700' },

    // Detail Specific
    rateBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
        borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)'
    },
    rateBadgeText: { color: '#10B981', fontSize: 10, fontWeight: '800' },

    // Balances & Settle Tabs
    balancesContainer: { paddingBottom: 20 },
    ledgerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 4 },
    ledgerTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
    ledgerCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.65)', borderRadius: 16, padding: 14,
        marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)'
    },
    ledgerCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    ledgerIconWrap: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: 'rgba(56,189,248,0.12)', justifyContent: 'center', alignItems: 'center'
    },
    ledgerCardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
    ledgerCardMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
    ledgerAmountBadge: {
        backgroundColor: 'rgba(99,102,241,0.15)', paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)'
    },
    ledgerAmountText: { color: '#A78BFA', fontSize: 13, fontWeight: '800' },
    ledgerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 10 },
    ledgerPaidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    ledgerPaidBy: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
    ledgerPerHead: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
    ledgerParticipants: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    participantChip: {
        backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10,
        paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
    },
    participantChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
    netBalanceRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    netAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    netAvatarLetter: { color: '#fff', fontSize: 14, fontWeight: '800' },
    netName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
    netAmount: { fontSize: 15, fontWeight: '800', marginRight: 6 },
    netLabel: { fontSize: 10, fontWeight: '700' },

    // Settle Tab
    settleSubtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 16 },
    settlementCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.65)', borderRadius: 18, padding: 18,
        marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)'
    },
    settlementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settlementPerson: { alignItems: 'center', gap: 6 },
    settleAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    settleAvatarLetter: { color: '#fff', fontSize: 18, fontWeight: '800' },
    settleName: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' },
    settleArrowWrap: { alignItems: 'center', gap: 4 },
    settleAmount: { color: '#38BDF8', fontSize: 16, fontWeight: '800' },
    convertedAmount: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', marginTop: 2 },
    settleActions: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
    magicPayRow: { flexDirection: 'row', gap: 10, marginBottom: 15, justifyContent: 'center' },
    magicBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    magicBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    settleActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, width: '100%' },
    settleActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    settleRateNote: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 12 },
});
