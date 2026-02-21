import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, Dimensions, Animated, Platform,
    useColorScheme, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Alert, Modal, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const TabButton = ({ label, active, onPress, theme }) => (
    <TouchableOpacity
        style={[styles.tabBtn, active && { backgroundColor: COLORS.indigo + '20' }]}
        onPress={onPress}
    >
        <Text style={[styles.tabText, { color: theme.textSecondary }, active && { color: COLORS.indigo }]}>{label}</Text>
    </TouchableOpacity>
);

export default function TripDetailScreen({ navigation, route }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DARK : LIGHT;

    const { trip } = route.params;
    const { user } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [activeTab, setActiveTab] = useState('Expenses');
    const [currentTrip, setCurrentTrip] = useState(trip);

    // Group Management State
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');

    // Expense Modal State
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [expenseTitle, setExpenseTitle] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('🍔 Food');
    const [expenseCurrency, setExpenseCurrency] = useState(trip.baseCurrency || 'USD');
    const [splitWith, setSplitWith] = useState([]); // Array of traveller indices/names
    const [isSavingExpense, setIsSavingExpense] = useState(false);
    const [liveRate, setLiveRate] = useState(null);

    const defaultCurrency = user?.defaultCurrency || 'USD';

    useEffect(() => {
        if (!trip?.id) return;

        // Trip Metadata Listener
        const tripRef = doc(db, 'trips', trip.id);
        const unsubTrip = onSnapshot(tripRef, (snapshot) => {
            if (snapshot.exists()) {
                setCurrentTrip({ id: snapshot.id, ...snapshot.data() });
            }
        });

        // Expenses Listener
        const q = query(
            collection(db, 'trips', trip.id, 'expenses')
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
            unsubExpenses();
        };
    }, [trip.id]);

    useEffect(() => {
        const fetchLiveRate = async () => {
            if (!currentTrip?.baseCurrency || currentTrip.baseCurrency === defaultCurrency) {
                setLiveRate(null);
                return;
            }

            const API_KEY = '0c65db1ed39247c720952a990c228cc4';
            try {
                const res = await fetch(`http://api.exchangerate.host/live?access_key=${API_KEY}&source=${defaultCurrency}`);
                const data = await res.json();
                if (data.success) {
                    const quoteKey = `${defaultCurrency}${currentTrip.baseCurrency}`;
                    const rate = data.quotes[quoteKey];
                    if (rate) setLiveRate(rate);
                }
            } catch (err) {
                console.log('Detail rate fetch failed:', err);
            }
        };

        fetchLiveRate();
    }, [currentTrip?.baseCurrency, defaultCurrency]);

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
            await updateDoc(doc(db, 'trips', currentTrip.id), {
                travellers: arrayUnion(newTraveller)
            });
            setNewMemberName('');
            setNewMemberEmail('');
            setShowAddMember(false);
        } catch (error) {
            console.error('Error adding traveller:', error);
            Alert.alert('Error', 'Failed to add traveller');
        }
    };

    const removeTraveller = async (traveller) => {
        if (traveller.isYou) {
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
                            await updateDoc(doc(db, 'trips', currentTrip.id), {
                                travellers: arrayRemove(traveller)
                            });
                        } catch (error) {
                            console.error('Error removing traveller:', error);
                        }
                    }
                }
            ]
        );
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

        setIsSavingExpense(true);
        try {
            const amount = parseFloat(expenseAmount);
            await addDoc(collection(db, 'trips', currentTrip.id, 'expenses'), {
                title: expenseTitle,
                amount: amount,
                category: expenseCategory,
                currency: expenseCurrency,
                splitWith: splitWith,
                paidBy: user.uid,
                paidByNickname: user.displayName || 'You',
                createdAt: serverTimestamp(),
                icon: expenseCategory.split(' ')[0],
                color: COLORS.indigo
            });

            // Update totalSpent in trip doc
            await updateDoc(doc(db, 'trips', currentTrip.id), {
                totalSpent: (currentTrip.totalSpent || 0) + amount
            });

            setExpenseTitle('');
            setExpenseAmount('');
            setSplitWith([]);
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
        if (splitWith.includes(name)) {
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
                            await deleteDoc(doc(db, 'trips', currentTrip.id, 'expenses', expense.id));
                            // Update totalSpent (downward)
                            await updateDoc(doc(db, 'trips', currentTrip.id), {
                                totalSpent: (currentTrip.totalSpent || 0) - (expense.amount || 0)
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

    const deleteTrip = async () => {
        Alert.alert(
            'Delete Trip',
            'This will permanently delete the trip and all its expenses. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'trips', currentTrip.id));
                            navigation.navigate('Trips');
                        } catch (error) {
                            console.error('Error deleting trip:', error);
                            Alert.alert('Error', 'Failed to delete trip');
                        }
                    }
                }
            ]
        );
    };

    const totalSpent = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const userBalance = trip.userBalance || 0;

    const handleFabPress = () => {
        if (activeTab === 'Group') {
            setShowAddMember(true);
        } else {
            setShowAddExpense(true);
        }
    };

    // ── Splitting Engine ──────────────────────────────────────────────────────
    // Build net balance map: { name -> net (positive = owed money back, negative = owes money) }
    const computeBalances = () => {
        const travellers = currentTrip.travellers || [];
        const balances = {}; // name -> net amount
        travellers.forEach(t => { balances[t.name] = 0; });

        expenses.forEach(expense => {
            const { amount, paidByNickname, splitWith: sw } = expense;
            if (!amount || !sw || sw.length === 0) return;

            const perHead = amount / sw.length;
            // Payer gets credited (net positive)
            if (balances.hasOwnProperty(paidByNickname)) {
                balances[paidByNickname] += amount;
            }
            // Each participant owes their share
            sw.forEach(name => {
                if (balances.hasOwnProperty(name)) {
                    balances[name] -= perHead;
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
                        <TouchableOpacity style={styles.circleBtn} onPress={deleteTrip}>
                            <Ionicons name="trash-outline" size={20} color="#F43F5E" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.circleBtn}>
                            <Ionicons name="share-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.tripHeader}>
                    <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']} style={styles.tripIcon}>
                        <Text style={{ fontSize: 32 }}>{trip.icon || '✈️'}</Text>
                    </LinearGradient>
                    <View>
                        <Text style={styles.tripName}>{trip.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.tripLocation}>{trip.destination || 'No location'}</Text>
                            {liveRate && (
                                <View style={styles.rateBadge}>
                                    <Text style={styles.rateBadgeText}>1 {defaultCurrency} ≈ {liveRate.toFixed(2)} {currentTrip.baseCurrency}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>TOTAL SPENT</Text>
                        <Text style={styles.statValue}>{currentTrip.baseCurrency} {totalSpent.toFixed(2)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>YOUR BAL</Text>
                        <Text style={[styles.statValue, { color: (currentTrip.userBalance || 0) >= 0 ? '#10B981' : '#EF4444' }]}>
                            {currentTrip.baseCurrency} {(currentTrip.userBalance || 0).toFixed(2)}
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
                <View style={[styles.budgetSection, { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
                    <View style={styles.budgetHeader}>
                        <View style={styles.budgetTitleRow}>
                            <MaterialCommunityIcons name="finance" size={16} color={COLORS.indigo} />
                            <Text style={[styles.budgetTitle, { color: theme.textSecondary }]}>BUDGET PROGRESS</Text>
                        </View>
                        <Text style={styles.budgetPercent}>{Math.round((totalSpent / (trip.budget || 1)) * 100)}%</Text>
                    </View>
                    <View style={[styles.budgetBarBg, { backgroundColor: theme.border }]}>
                        <View style={[styles.budgetBarFill, { width: `${Math.min((totalSpent / (trip.budget || 1)) * 100, 100)}%` }]} />
                    </View>
                    <Text style={[styles.budgetRemaining, { color: theme.textMuted }]}>Remaining: {trip.baseCurrency} {(trip.budget - totalSpent).toFixed(2)}</Text>
                </View>

                {/* Tabs */}
                <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
                    <TabButton label="Expenses" active={activeTab === 'Expenses'} onPress={() => setActiveTab('Expenses')} theme={theme} />
                    <TabButton label="Balances" active={activeTab === 'Balances'} onPress={() => setActiveTab('Balances')} theme={theme} />
                    <TabButton label="Settle" active={activeTab === 'Settle'} onPress={() => setActiveTab('Settle')} theme={theme} />
                    <TabButton label="Group" active={activeTab === 'Group'} onPress={() => setActiveTab('Group')} theme={theme} />
                </View>

                {/* List Content */}
                {activeTab === 'Expenses' && (
                    expenses.length > 0 ? (
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
                                    <Text style={[styles.expenseAmount, { color: theme.textPrimary }]}>{currentTrip.baseCurrency} {expense.amount.toFixed(2)}</Text>
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
                    )
                )}

                {/* ── BALANCES TAB ─────────────────────────────────────── */}
                {activeTab === 'Balances' && (
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
                                    const perHead = sw.length > 0 ? (expense.amount / sw.length) : 0;
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
                                                    <Text style={styles.ledgerCardMeta}>{expense.category} · {sw.length} people</Text>
                                                </View>
                                                <View style={styles.ledgerAmountBadge}>
                                                    <Text style={styles.ledgerAmountText}>{currentTrip.baseCurrency} {expense.amount.toFixed(2)}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.ledgerDivider} />
                                            <View style={styles.ledgerPaidRow}>
                                                <Text style={styles.ledgerPaidBy}>💳 {expense.paidByNickname || 'Someone'} paid</Text>
                                                <Text style={styles.ledgerPerHead}>{currentTrip.baseCurrency} {perHead.toFixed(2)}/person</Text>
                                            </View>
                                            <View style={styles.ledgerParticipants}>
                                                {sw.map((name, ni) => (
                                                    <View key={ni} style={styles.participantChip}>
                                                        <Text style={styles.participantChipText}>{name}</Text>
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
                                {Object.entries(balances).map(([name, net]) => (
                                    <View key={name} style={styles.netBalanceRow}>
                                        <View style={[styles.netAvatar, { backgroundColor: (currentTrip.travellers?.find(t => t.name === name)?.color) || '#38BDF8' }]}>
                                            <Text style={styles.netAvatarLetter}>{name[0]}</Text>
                                        </View>
                                        <Text style={styles.netName}>{name}</Text>
                                        <Text style={[styles.netAmount, { color: net >= 0 ? '#10B981' : '#EF4444' }]}>
                                            {net >= 0 ? '+' : ''}{currentTrip.baseCurrency} {net.toFixed(2)}
                                        </Text>
                                        <Text style={[styles.netLabel, { color: net >= 0 ? '#10B981' : '#EF4444' }]}>
                                            {net >= 0 ? 'gets back' : 'owes'}
                                        </Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                )}

                {/* ── SETTLE TAB ───────────────────────────────────────── */}
                {activeTab === 'Settle' && (
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
                            settlements.map((s, i) => (
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
                                            <Ionicons name="arrow-forward" size={18} color="#38BDF8" />
                                        </View>
                                        <View style={styles.settlementPerson}>
                                            <View style={[styles.settleAvatar, { backgroundColor: (currentTrip.travellers?.find(t => t.name === s.to)?.color) || '#10B981' }]}>
                                                <Text style={styles.settleAvatarLetter}>{s.to[0]}</Text>
                                            </View>
                                            <Text style={styles.settleName}>{s.to}</Text>
                                        </View>
                                    </View>
                                    {liveRate && (
                                        <Text style={styles.settleRateNote}>
                                            ≈ {defaultCurrency} {(s.amount / liveRate).toFixed(2)} at 1 {defaultCurrency} = {liveRate.toFixed(3)} {currentTrip.baseCurrency}
                                        </Text>
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {activeTab === 'Group' && (
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

                        {currentTrip.travellers?.map((t, i) => (
                            <View key={i} style={styles.travellerCard}>
                                <View style={[styles.travellerAvatarLarge, { backgroundColor: t.color || '#38BDF8' }]}>
                                    <Text style={styles.travellerLetterLarge}>{t.letter}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={styles.travellerName}>{t.name} {t.isYou ? '(You)' : ''}</Text>
                                    <Text style={styles.travellerEmail}>{t.email || 'No email'}</Text>
                                </View>
                                {!t.isYou && (
                                    <TouchableOpacity onPress={() => removeTraveller(t)}>
                                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Dynamic FAB */}
            <View style={styles.fabContainer}>
                <TouchableOpacity style={styles.mainFab} onPress={handleFabPress} activeOpacity={0.9}>
                    <LinearGradient
                        colors={activeTab === 'Group' ? ['#6366F1', '#A855F7'] : ['#EC4899', '#8B5CF6']}
                        style={styles.mainFabGradient}
                    >
                        <Ionicons
                            name={activeTab === 'Group' ? "person-add" : "receipt"}
                            size={28}
                            color="#fff"
                        />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

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
                                <Text style={styles.inputLabel}>SPLIT WITH</Text>
                                <View style={styles.friendList}>
                                    {currentTrip.travellers?.map((traveller, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[styles.friendItem, splitWith.includes(traveller.name) && styles.friendItemActive]}
                                            onPress={() => toggleSplit(traveller)}
                                        >
                                            <View style={[styles.friendAvatar, { backgroundColor: traveller.color }]}>
                                                <Text style={styles.friendLetter}>{traveller.letter}</Text>
                                            </View>
                                            <Text style={styles.friendName}>{traveller.name}</Text>
                                            <Ionicons
                                                name={splitWith.includes(traveller.name) ? "checkbox" : "square-outline"}
                                                size={20}
                                                color={splitWith.includes(traveller.name) ? COLORS.indigo : "rgba(255,255,255,0.2)"}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
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
    scrollContent: { padding: 20 },
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
    settleRateNote: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 12 },
});
