import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, Dimensions, useColorScheme, ActivityIndicator,
    Alert, Modal, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, LIGHT, DARK } from '../constants/theme';
import { db } from '../config/firebase';
import {
    collection, query, onSnapshot, doc, updateDoc,
    arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const ICONS = ['🗼', '⛩️', '🗽', '🏖️', '⛰️', '🌴', '💃', '🥘', '🏛️', '🎭', '🎡', '🏰', '🗿', '🛶', '🚢', '🎿'];
const DEFAULT_CURRENCIES = [
    { label: '🇺🇸 USD', value: 'USD' },
    { label: '🇪🇺 EUR', value: 'EUR' },
    { label: '🇬🇧 GBP', value: 'GBP' },
    { label: '🇮🇳 INR', value: 'INR' },
    { label: '🇯🇵 JPY', value: 'JPY' },
    { label: '🇦🇺 AUD', value: 'AUD' },
    { label: '🇸🇬 SGD', value: 'SGD' },
    { label: '🇹🇭 THB', value: 'THB' },
];

export default function TripDetailScreen({ navigation, route }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DARK : LIGHT;

    const { trip } = route.params;
    const { user } = useAuth();
    const [currentTrip, setCurrentTrip] = useState(trip);
    const [destinations, setDestinations] = useState([]);
    const [activeTab, setActiveTab] = useState('Destinations');

    // Add Destination Modal
    const [showAddDest, setShowAddDest] = useState(false);
    const [destName, setDestName] = useState('');
    const [destIcon, setDestIcon] = useState('📍');
    const [destCurrency, setDestCurrency] = useState(user?.defaultCurrency || 'USD');
    const [availableCurrencies, setAvailableCurrencies] = useState(DEFAULT_CURRENCIES);
    const [destBudget, setDestBudget] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDetectingCurrency, setIsDetectingCurrency] = useState(false);
    const [liveRates, setLiveRates] = useState({});
    const defaultCurrency = user?.defaultCurrency || 'USD';

    // Add Member Modal
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');

    // Listen to trip metadata
    useEffect(() => {
        if (!trip?.id) return;
        const tripRef = doc(db, 'trips', trip.id);
        const unsub = onSnapshot(tripRef, (snapshot) => {
            if (snapshot.exists()) {
                setCurrentTrip({ id: snapshot.id, ...snapshot.data() });
            }
        });
        return () => unsub();
    }, [trip.id]);

    // Listen to destinations sub-collection
    useEffect(() => {
        if (!trip?.id) return;
        const q = query(collection(db, 'trips', trip.id, 'destinations'));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
            });
            data.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            setDestinations(data);
        });
        return () => unsub();
    }, [trip.id]);

    // Robust Auto-Fix: Keep Trip Destination synced with Destinations list
    useEffect(() => {
        if (!currentTrip || !trip?.id) return;

        // Sync count and first destination name
        const firstDestName = destinations.length > 0 ? destinations[0].name : 'No location';
        const count = destinations.length;

        const needsUpdate = currentTrip.destination !== firstDestName || currentTrip.destinationCount !== count;

        if (needsUpdate) {
            updateDoc(doc(db, 'trips', trip.id), {
                destination: firstDestName,
                destinationCount: count
            });
        }
    }, [destinations, currentTrip?.destination, currentTrip?.destinationCount]);

    // Auto-detect Currency based on Destination Name
    useEffect(() => {
        if (!destName || destName.length < 3) return;

        const timer = setTimeout(async () => {
            setIsDetectingCurrency(true);
            try {
                let searchTerm = destName.trim();
                // If contains comma, prioritize the last part as country
                if (searchTerm.includes(',')) {
                    searchTerm = searchTerm.split(',').pop().trim();
                }

                // Try searching by country name
                let res = await fetch(`https://restcountries.com/v3.1/name/${searchTerm}`);
                let countries = await res.json();

                // If name search fails (404) or returns no results, try searching by capital
                if ((!Array.isArray(countries) || countries.length === 0 || countries.status === 404)) {
                    // Use the original destination for capital search if no comma, otherwise use first part
                    const capitalSearch = destName.includes(',') ? destName.split(',')[0].trim() : destName.trim();
                    const capRes = await fetch(`https://restcountries.com/v3.1/capital/${capitalSearch}`);
                    const capData = await capRes.json();
                    if (Array.isArray(capData) && capData.length > 0) {
                        countries = capData;
                    }
                }

                if (countries && Array.isArray(countries) && countries[0] && countries[0].currencies) {
                    const currencyCode = Object.keys(countries[0].currencies)[0];
                    if (currencyCode) {
                        setDestCurrency(currencyCode);
                        const flag = countries[0].flag || '🌐';
                        const newEntry = { label: `${flag} ${currencyCode}`, value: currencyCode };

                        setAvailableCurrencies(prev => {
                            // Filter out the currency if it already exists to avoid duplicates
                            const filtered = prev.filter(c => c.value !== currencyCode);
                            // Add the detected currency (with its specific flag) to the front
                            return [newEntry, ...filtered];
                        });
                    }
                }
            } catch (err) {
                console.log('Currency detection failed:', err);
            } finally {
                setIsDetectingCurrency(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [destName]);

    const addDestination = async () => {
        if (!destName.trim()) {
            Alert.alert('Required', 'Please enter a destination name');
            return;
        }
        setIsSaving(true);
        try {
            await addDoc(collection(db, 'trips', trip.id, 'destinations'), {
                name: destName,
                icon: destIcon,
                baseCurrency: destCurrency,
                budget: parseFloat(destBudget) || 0,
                totalSpent: 0,
                createdAt: serverTimestamp(),
            });

            // Update parent trip's destination field if it's empty or placeholder
            if (!currentTrip.destination || currentTrip.destination === 'No location' || currentTrip.destination === 'Destination not set') {
                await updateDoc(doc(db, 'trips', trip.id), {
                    destination: destName
                });
            }

            setDestName('');
            setDestIcon('📍');
            setDestBudget('');
            setDestCurrency(user?.defaultCurrency || 'USD');
            setShowAddDest(false);
        } catch (error) {
            console.error('Error adding destination:', error);
            Alert.alert('Error', 'Failed to add destination');
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        const fetchTripRates = async () => {
            const currencies = Array.from(new Set(destinations.map(d => d.baseCurrency).filter(c => c && c !== defaultCurrency)));
            if (currencies.length === 0) {
                setLiveRates({});
                return;
            }

            try {
                const res = await fetch(`https://api.frankfurter.app/latest?from=${defaultCurrency}`);
                if (!res.ok) {
                    setLiveRates({});
                    return;
                }
                const data = await res.json();
                if (data.rates) {
                    const newRates = {};
                    currencies.forEach(curr => {
                        newRates[curr] = data.rates[curr] || null;
                    });
                    setLiveRates(newRates);
                }
            } catch (err) {
                console.log('Trip rates fetch failed:', err);
                setLiveRates({});
            }
        };

        fetchTripRates();
    }, [destinations, defaultCurrency]);

    const addTraveller = async () => {
        if (!newMemberName.trim()) return;
        try {
            const colors = [COLORS.red, COLORS.green, COLORS.orange, COLORS.violet, '#10B981', '#34D399', '#F59E0B'];
            const newTraveller = {
                name: newMemberName,
                email: newMemberEmail,
                color: colors[currentTrip.travellers?.length % colors.length],
                letter: newMemberName.substring(0, 1).toUpperCase(),
                paymentModes: ['Cash']
            };
            const updateObj = { travellers: arrayUnion(newTraveller) };
            if (newMemberEmail) {
                updateObj.travellerEmails = arrayUnion(newMemberEmail.toLowerCase());
            }
            await updateDoc(doc(db, 'trips', currentTrip.id), updateObj);
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
        Alert.alert('Remove Traveller', `Remove ${traveller.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                    try {
                        const updateObj = { travellers: arrayRemove(traveller) };
                        if (traveller.email) {
                            updateObj.travellerEmails = arrayRemove(traveller.email.toLowerCase());
                        }
                        await updateDoc(doc(db, 'trips', currentTrip.id), updateObj);
                    } catch (error) {
                        console.error('Error removing traveller:', error);
                    }
                }
            }
        ]);
    };


    const toggleDestStatus = async (destId, currentStatus) => {
        try {
            const newStatus = currentStatus === 'Completed' ? 'Active' : 'Completed';
            await updateDoc(doc(db, 'trips', currentTrip.id, 'destinations', destId), {
                status: newStatus
            });
        } catch (error) {
            console.error('Error updating destination status:', error);
        }
    };


    const deleteTrip = async () => {
        Alert.alert('Delete Trip', 'Permanently delete this trip and all destinations?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'trips', currentTrip.id));
                        navigation.replace('MainTabs', { screen: 'Trips' });
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete trip');
                    }
                }
            }
        ]);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    };

    const totalBudgetAcrossDests = destinations.reduce((s, d) => s + (d.budget || 0), 0);
    const totalSpentAcrossDests = destinations.reduce((s, d) => s + (d.totalSpent || 0), 0);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" translucent />

            {/* Header */}
            <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.backdrop}>
                <View style={styles.headerNav}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerRight}>
                        <TouchableOpacity style={styles.circleBtn} onPress={deleteTrip}>
                            <Ionicons name="trash-outline" size={20} color="#F43F5E" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.tripHeader}>
                    <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']} style={styles.tripIcon}>
                        <Text style={{ fontSize: 32 }}>{currentTrip?.icon || '✈️'}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.tripName}>{currentTrip?.name || trip.name}</Text>
                        <Text style={styles.tripLocation}>
                            {formatDate(currentTrip?.startDate)} - {formatDate(currentTrip?.endDate)} · {currentTrip?.status}
                        </Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>DESTINATIONS</Text>
                        <Text style={styles.statValue}>{destinations.length}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>TRAVELLERS</Text>
                        <View style={styles.miniAvatars}>
                            {currentTrip.travellers?.slice(0, 3).map((t, i) => (
                                <View key={i} style={[styles.miniAvatar, { backgroundColor: t.color || COLORS.violet, marginLeft: i > 0 ? -8 : 0 }]}>
                                    <Text style={styles.miniAvatarText}>{t.letter}</Text>
                                </View>
                            ))}
                            {currentTrip.travellers?.length > 3 && (
                                <View style={[styles.miniAvatar, { backgroundColor: '#374151', marginLeft: -8 }]}>
                                    <Text style={styles.miniAvatarText}>+{currentTrip.travellers.length - 3}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>STATUS</Text>
                        <Text style={[styles.statValue, { color: currentTrip?.status === 'Active' ? '#10B981' : '#A78BFA', fontSize: 13 }]}>
                            {currentTrip?.status || 'Planning'}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'Destinations' && { backgroundColor: COLORS.indigo + '20' }]}
                    onPress={() => setActiveTab('Destinations')}
                >
                    <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === 'Destinations' && { color: COLORS.indigo }]}>Destinations</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'Group' && { backgroundColor: COLORS.indigo + '20' }]}
                    onPress={() => setActiveTab('Group')}
                >
                    <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === 'Group' && { color: COLORS.indigo }]}>Group</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Background Decoration */}
                <View style={[styles.bubble, { top: 50, right: -60, backgroundColor: COLORS.purpleBubble }]} />
                <View style={[styles.bubble, { top: 400, left: -80, width: 280, height: 280, backgroundColor: COLORS.cyanBubble }]} />

                {activeTab === 'Destinations' && (
                    <>
                        {destinations.length > 0 ? (
                            <>
                                {destinations.filter(d => d.status !== 'Completed').map((dest) => {
                                    const spent = dest.totalSpent || 0;
                                    const budget = dest.budget || 0;
                                    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

                                    return (
                                        <View key={dest.id} style={{ marginBottom: 16 }}>
                                            <TouchableOpacity
                                                style={styles.destCard}
                                                activeOpacity={0.8}
                                                onPress={() => navigation.navigate('DestinationDetail', {
                                                    destination: dest,
                                                    tripId: currentTrip.id,
                                                    tripData: currentTrip,
                                                })}
                                            >
                                                <LinearGradient
                                                    colors={['rgba(15, 23, 42, 0.8)', 'rgba(30, 41, 59, 0.6)']}
                                                    style={styles.destCardGradient}
                                                >
                                                    <View style={styles.destCardHeader}>
                                                        <View style={styles.destIconWrap}>
                                                            <Text style={{ fontSize: 18 }}>{dest.icon || '📍'}</Text>
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.destCardName}>{dest.name}</Text>
                                                            <Text style={styles.destCardCurrency}>{dest.baseCurrency}</Text>
                                                        </View>
                                                        <View style={styles.destSpentBadge}>
                                                            <Text style={styles.destSpentText}>
                                                                {dest.baseCurrency} {spent.toFixed(0)}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    {budget > 0 && (
                                                        <View style={styles.destBudgetRow}>
                                                            <View style={styles.destBarBg}>
                                                                <View style={[styles.destBarFill, { width: `${pct}%` }]} />
                                                            </View>
                                                            <Text style={styles.destBudgetLabel}>
                                                                {pct.toFixed(0)}% of {dest.baseCurrency} {budget.toFixed(0)}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </LinearGradient>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.inlineCompleteBtn}
                                                onPress={() => toggleDestStatus(dest.id, dest.status)}
                                            >
                                                <Text style={styles.inlineCompleteBtnText}>Complete Destination</Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}

                                {destinations.filter(d => d.status === 'Completed').length > 0 && (
                                    <>
                                        <View style={styles.completedHeader}>
                                            <Ionicons name="checkmark-done" size={16} color="rgba(255,255,255,0.4)" />
                                            <Text style={styles.completedHeaderText}>COMPLETED DESTINATIONS</Text>
                                        </View>
                                        {destinations.filter(d => d.status === 'Completed').map((dest) => (
                                            <TouchableOpacity
                                                key={dest.id}
                                                style={[styles.destCard, { opacity: 0.6 }]}
                                                onPress={() => navigation.navigate('DestinationDetail', {
                                                    destination: dest,
                                                    tripId: currentTrip.id,
                                                    tripData: currentTrip
                                                })}
                                            >
                                                <LinearGradient
                                                    colors={['rgba(15, 23, 42, 0.4)', 'rgba(30, 41, 59, 0.3)']}
                                                    style={styles.destCardGradient}
                                                >
                                                    <View style={styles.destCardHeader}>
                                                        <View style={[styles.destIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                                            <Text style={{ fontSize: 18 }}>{dest.icon || '📍'}</Text>
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[styles.destCardName, { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.4)' }]}>{dest.name}</Text>
                                                        </View>
                                                    </View>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        ))}
                                    </>
                                )}
                            </>
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="location-outline" size={56} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textPrimary }]}>No destinations yet</Text>
                                <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
                                    Add your first destination to start tracking expenses
                                </Text>
                            </View>
                        )}

                        {/* Live Rates Section */}
                        <View style={styles.liveRatesSection}>
                            <View style={styles.liveRatesHeader}>
                                <View style={styles.liveRatesDot} />
                                <Text style={styles.liveRatesHeaderTitle}>TRIP RATES (FROM {defaultCurrency})</Text>
                            </View>

                            {Object.keys(liveRates).length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ratesScroll}>
                                    {Object.entries(liveRates).map(([curr, rate]) => (
                                        <View key={curr} style={styles.rateCard}>
                                            <View style={styles.rateHeader}>
                                                <Text style={styles.rateCurr}>{curr}</Text>
                                                {rate === null && (
                                                    <Ionicons name="alert-circle-outline" size={10} color="rgba(255,255,255,0.3)" />
                                                )}
                                            </View>
                                            <Text style={[styles.rateValue, rate === null && { color: 'rgba(255,255,255,0.3)' }]}>
                                                {rate !== null ? rate.toFixed(3) : 'N/A'}
                                            </Text>
                                            <Text style={styles.rateTrend}>{rate !== null ? '+0.00%' : 'Unsupported'}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <View style={styles.noRatesContainer}>
                                    <Text style={styles.noRatesText}>
                                        {destinations.length > 0
                                            ? 'Fetching latest exchange rates...'
                                            : 'Add destinations to see live rates'}
                                    </Text>
                                </View>
                            )}
                        </View>

                    </>
                )}

                {activeTab === 'Group' && (
                    <View style={styles.groupContainer}>
                        <View style={styles.groupHeader}>
                            <Text style={styles.groupTitle}>Trip Members</Text>
                            <TouchableOpacity style={styles.addMemberBtn} onPress={() => setShowAddMember(true)}>
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
                )}
            </ScrollView>

            {/* FAB */}
            <View style={styles.fabContainer}>
                <TouchableOpacity
                    style={styles.mainFab}
                    activeOpacity={0.9}
                    onPress={() => {
                        if (activeTab === 'Group') setShowAddMember(true);
                        else setShowAddDest(true);
                    }}
                >
                    <LinearGradient
                        colors={activeTab === 'Group' ? ['#6366F1', '#A855F7'] : ['#0EA5E9', '#2DD4BF']}
                        style={styles.mainFabGradient}
                    >
                        <Ionicons
                            name={activeTab === 'Group' ? 'person-add' : 'add'}
                            size={26}
                            color="#fff"
                        />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Add Destination Modal */}
            <Modal visible={showAddDest} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Destination</Text>
                            <TouchableOpacity onPress={() => setShowAddDest(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>CHOOSE ICON</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconSelectionRow}>
                                {ICONS.map(icon => (
                                    <TouchableOpacity
                                        key={icon}
                                        onPress={() => setDestIcon(icon)}
                                        style={[styles.smallIconChip, destIcon === icon && styles.smallIconChipActive]}
                                    >
                                        <Text style={styles.smallIconEmoji}>{icon}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={[styles.inputGroup, { marginTop: 20 }]}>
                            <Text style={styles.inputLabel}>DESTINATION NAME</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="location-outline" size={18} color="rgba(255,255,255,0.4)" />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="e.g. Paris, Tokyo, Bali"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={destName}
                                    onChangeText={setDestName}
                                />
                            </View>
                        </View>

                        <View style={[styles.inputGroup, { marginTop: 20 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.inputLabel}>LOCAL CURRENCY</Text>
                                {isDetectingCurrency && <ActivityIndicator size="small" color="#0EA5E9" />}
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                {availableCurrencies.map(c => (
                                    <TouchableOpacity
                                        key={c.value}
                                        onPress={() => setDestCurrency(c.value)}
                                        style={[styles.currencyChip, destCurrency === c.value && styles.currencyChipActive]}
                                    >
                                        <Text style={[styles.currencyChipText, destCurrency === c.value && { color: '#fff' }]}>{c.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={[styles.inputGroup, { marginTop: 20 }]}>
                            <Text style={styles.inputLabel}>BUDGET (OPTIONAL)</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="cash-outline" size={18} color="rgba(255,255,255,0.4)" />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter budget"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    keyboardType="numeric"
                                    value={destBudget}
                                    onChangeText={setDestBudget}
                                />
                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '700' }}>{destCurrency}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.submitBtn, (!destName.trim() || isSaving) && { opacity: 0.5 }]}
                            onPress={addDestination}
                            disabled={!destName.trim() || isSaving}
                        >
                            <LinearGradient colors={['#0EA5E9', '#2DD4BF']} style={styles.submitGradient}>
                                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Destination</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    bubble: {
        position: 'absolute', width: 300, height: 300,
        borderRadius: 150, zIndex: 0, opacity: 0.15,
    },
    backdrop: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerRight: { flexDirection: 'row', gap: 10 },
    circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    tripHeader: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 25 },
    tripIcon: { width: 64, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    tripName: { color: '#fff', fontSize: 24, fontWeight: '800' },
    tripLocation: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: 10 },
    statItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800', marginBottom: 4 },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
    miniAvatars: { flexDirection: 'row', alignItems: 'center' },
    miniAvatar: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#7C3AED' },
    miniAvatarText: { color: '#fff', fontSize: 8, fontWeight: '800' },
    tabContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginHorizontal: 20, marginTop: 15 },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    tabText: { fontSize: 13, fontWeight: '700' },
    content: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 100 },

    // Destination Cards
    destCard: { marginBottom: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    destCardGradient: { padding: 18 },
    destCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    destIconWrap: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: 'rgba(56,189,248,0.12)', justifyContent: 'center', alignItems: 'center',
    },
    destCardName: { color: '#fff', fontSize: 17, fontWeight: '700' },
    destCardCurrency: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginTop: 2 },
    destSpentBadge: {
        backgroundColor: 'rgba(99,102,241,0.15)', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
    },
    destSpentText: { color: '#A78BFA', fontSize: 13, fontWeight: '800' },
    destBudgetRow: { marginTop: 14 },
    destBarBg: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
    destBarFill: { height: '100%', backgroundColor: COLORS.indigo, borderRadius: 3 },
    destBudgetLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', marginTop: 6, textAlign: 'right' },
    destCardFooter: { alignItems: 'flex-end', marginTop: 10 },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 18, fontWeight: '700', marginTop: 15 },
    emptySubtext: { fontSize: 13, marginTop: 6, textAlign: 'center' },

    // FAB
    fabContainer: { position: 'absolute', bottom: 30, alignSelf: 'center', alignItems: 'center' },
    mainFab: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', elevation: 10 },
    mainFabGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Group Tab
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

    // Modal
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

    // Currency chips
    currencyChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    currencyChipActive: { backgroundColor: COLORS.indigo, borderColor: COLORS.indigo },
    currencyChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },

    // Icon Selector Styles
    iconSelectionRow: { flexDirection: 'row', marginBottom: 15 },
    smallIconChip: {
        width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
    },
    smallIconChipActive: { borderColor: '#0EA5E9', backgroundColor: 'rgba(14, 165, 233, 0.15)' },
    smallIconEmoji: { fontSize: 22 },

    // Live Rates Section (from Home)
    liveRatesSection: {
        marginTop: 30,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    liveRatesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    liveRatesDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#2DD4BF',
    },
    liveRatesHeaderTitle: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    ratesScroll: {
        flexDirection: 'row',
    },
    rateCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: 12,
        borderRadius: 14,
        marginRight: 10,
        minWidth: 85,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    rateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    rateCurr: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
        fontWeight: '700',
    },
    rateValue: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    rateTrend: {
        color: '#10B981',
        fontSize: 9,
        fontWeight: '700',
        marginTop: 2,
    },
    noRatesContainer: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    noRatesText: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 12,
        fontWeight: '600',
    },
    completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 30, marginBottom: 15, paddingHorizontal: 4 },
    completedHeaderText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
    destActionBtn: {
        padding: 4,
    },
    destCheckCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    destCheckCircleActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    inlineCompleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderRadius: 12,
        marginTop: -4,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.1)',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
    },
    inlineCompleteBtnText: {
        color: '#10B981',
        fontSize: 12,
        fontWeight: '700',
    },
    completeTripLargeBtn: {
        marginTop: 30,
        marginBottom: 60,
        borderRadius: 18,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    completeTripGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 12,
    },
    completeTripText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1,
    },
});
