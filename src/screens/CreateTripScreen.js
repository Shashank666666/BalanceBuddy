import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, TextInput, Dimensions, KeyboardAvoidingView, Platform,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Alert, ActivityIndicator } from 'react-native';

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

export default function CreateTripScreen({ navigation }) {
    const theme = DARK;

    const { user } = useAuth();
    const [step, setStep] = useState(1); // 1: Details, 2: Travellers, 3: Review
    const [isCreating, setIsCreating] = useState(false);

    // State for Trip Details
    const [tripName, setTripName] = useState('');
    const [destination, setDestination] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('🗼');
    const [baseCurrency, setBaseCurrency] = useState('USD');
    const [availableCurrencies, setAvailableCurrencies] = useState(DEFAULT_CURRENCIES);
    const [tripStatus, setTripStatus] = useState('Active'); // Active or Planning
    const [budget, setBudget] = useState('');
    const [isDetectingCurrency, setIsDetectingCurrency] = useState(false);

    // Dates
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectingType, setSelectingType] = useState('start'); // 'start' or 'end'

    // Exchange Rate
    const [liveRate, setLiveRate] = useState(null);
    const defaultCurrency = user?.defaultCurrency || 'USD';

    // Auto-detect Currency based on Destination
    useEffect(() => {
        if (!destination || destination.length < 3) return;

        const timer = setTimeout(async () => {
            setIsDetectingCurrency(true);
            try {
                // Try to find the country/city currency using RestCountries API
                const res = await fetch(`https://restcountries.com/v3.1/name/${destination.trim()}`);
                const countries = await res.json();

                if (countries && countries[0] && countries[0].currencies) {
                    const currencyCode = Object.keys(countries[0].currencies)[0];
                    if (currencyCode) {
                        setBaseCurrency(currencyCode);
                        // Add to available if not present
                        if (!availableCurrencies.find(c => c.value === currencyCode)) {
                            const flag = countries[0].flag || '🌐';
                            setAvailableCurrencies(prev => [{ label: `${flag} ${currencyCode}`, value: currencyCode }, ...prev]);
                        }
                    }
                }
            } catch (err) {
                console.log('Currency detection failed:', err);
            } finally {
                setIsDetectingCurrency(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [destination]);

    // Fetch Live Rate between Default and Destination
    useEffect(() => {
        const fetchLiveRate = async () => {
            if (!baseCurrency || baseCurrency === defaultCurrency) {
                setLiveRate(null);
                return;
            }
            const API_KEY = '0c65db1ed39247c720952a990c228cc4';
            try {
                const res = await fetch(`http://api.exchangerate.host/live?access_key=${API_KEY}&source=${defaultCurrency}`);
                const data = await res.json();
                if (data.success) {
                    const quoteKey = `${defaultCurrency}${baseCurrency}`;
                    const rate = data.quotes[quoteKey];
                    if (rate) setLiveRate(rate);
                }
            } catch (err) {
                console.log('Live rate fetch failed:', err);
            }
        };
        fetchLiveRate();
    }, [baseCurrency, defaultCurrency]);

    // State for Travellers
    const [travellers, setTravellers] = useState([
        { name: 'You (You)', email: 'me@splitmate.app', isYou: true, color: COLORS.avatarM, letter: 'ME' }
    ]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTraveller, setNewTraveller] = useState({ name: '', email: '', currency: 'EUR', paymentModes: ['Cash'] });

    const addTraveller = () => {
        if (newTraveller.name) {
            const colors = [COLORS.red, COLORS.green, COLORS.orange, COLORS.violet, '#10B981', '#34D399', '#F59E0B'];
            setTravellers([...travellers, {
                ...newTraveller,
                color: colors[travellers.length % colors.length],
                letter: newTraveller.name.substring(0, 1).toUpperCase()
            }]);
            setNewTraveller({ name: '', email: '', currency: 'EUR', paymentModes: ['Cash'] });
            setShowAddForm(false);
        }
    };

    const removeTraveller = (index) => {
        if (!travellers[index].isYou) {
            setTravellers(travellers.filter((_, i) => i !== index));
        }
    };

    const togglePaymentMode = (mode) => {
        const currentModes = newTraveller.paymentModes;
        if (currentModes.includes(mode)) {
            setNewTraveller({ ...newTraveller, paymentModes: currentModes.filter(m => m !== mode) });
        } else {
            setNewTraveller({ ...newTraveller, paymentModes: [...currentModes, mode] });
        }
    };

    const handleCreateTrip = async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to create a trip');
            return;
        }

        setIsCreating(true);
        try {
            const tripData = {
                name: tripName,
                destination: destination,
                icon: selectedIcon,
                baseCurrency: baseCurrency,
                status: tripStatus,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                budget: parseFloat(budget) || 0,
                travellers: travellers,
                creatorId: user.uid,
                createdAt: serverTimestamp(),
                // Initial stats
                totalSpent: 0,
                userBalance: 0,
            };

            const docRef = await addDoc(collection(db, 'trips'), tripData);
            console.log('Trip created with ID: ', docRef.id);
            navigation.replace('MainTabs'); // Go to Home
        } catch (error) {
            console.error('Error adding document: ', error);
            Alert.alert('Error', 'Failed to create trip. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const renderHeader = () => {
        const steps = [
            { id: 1, title: 'Details', icon: 'document-text-outline' },
            { id: 2, title: 'Travellers', icon: 'people-outline' },
            { id: 3, title: 'Confirm', icon: 'checkmark-circle-outline' }
        ];

        return (
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
                        style={styles.backBtn}
                    >
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Plan Trip</Text>
                        <Text style={styles.headerSubtitle}>Step {step} of 3</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                {/* Modern Step Indicator */}
                <View style={styles.stepsIndicatorContainer}>
                    {steps.map((s, i) => (
                        <React.Fragment key={s.id}>
                            <View style={styles.stepBubbleContainer}>
                                <View style={[
                                    styles.stepBubble,
                                    step >= s.id && styles.stepBubbleActive,
                                    step === s.id && styles.stepBubbleCurrent
                                ]}>
                                    <Ionicons
                                        name={s.icon}
                                        size={18}
                                        color={step >= s.id ? '#fff' : 'rgba(255,255,255,0.4)'}
                                    />
                                </View>
                                <Text style={[
                                    styles.stepTabText,
                                    step >= s.id && styles.stepTabTextActive
                                ]}>{s.title}</Text>
                            </View>
                            {i < steps.length - 1 && (
                                <View style={[
                                    styles.stepLine,
                                    step > s.id && styles.stepLineActive
                                ]} />
                            )}
                        </React.Fragment>
                    ))}
                </View>

                {/* Visual Decorations */}
                <View style={[styles.headerCircle, { top: -20, right: -40, width: 140, height: 140, opacity: 0.1, backgroundColor: '#0EA5E9' }]} />
                <View style={[styles.headerCircle, { bottom: -30, left: -20, width: 100, height: 100, opacity: 0.05, backgroundColor: '#2DD4BF' }]} />
            </LinearGradient>
        );
    };

    const renderStep1 = () => (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Trip Identity Section */}
            <View style={styles.glassCard}>
                <Text style={styles.inputLabel}>CHOOSE YOUR ICON</Text>
                <View style={styles.iconSelectionRow}>
                    <View style={styles.selectedIconLargeContainer}>
                        <LinearGradient
                            colors={['#0EA5E9', '#2DD4BF']}
                            style={styles.selectedIconLarge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.selectedIconEmojiLarge}>{selectedIcon}</Text>
                        </LinearGradient>
                    </View>
                    <View style={{ flex: 1 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconSelector}>
                            {ICONS.map(icon => (
                                <TouchableOpacity
                                    key={icon}
                                    onPress={() => setSelectedIcon(icon)}
                                    style={[styles.smallIconChip, selectedIcon === icon && styles.smallIconChipActive]}
                                >
                                    <Text style={styles.smallIconEmoji}>{icon}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <Text style={styles.helperText}>Swipe to explore icons</Text>
                    </View>
                </View>

                <Text style={[styles.inputLabel, { marginTop: 25 }]}>TRIP NAME</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="briefcase-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                    <TextInput
                        style={styles.premiumInput}
                        value={tripName}
                        onChangeText={setTripName}
                        placeholder="e.g. Summer in Tokyo"
                        placeholderTextColor={COLORS.textMuted}
                    />
                </View>

                <Text style={[styles.inputLabel, { marginTop: 20 }]}>DESTINATION</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="location-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                    <TextInput
                        style={styles.premiumInput}
                        value={destination}
                        onChangeText={setDestination}
                        placeholder="Where are you heading?"
                        placeholderTextColor={COLORS.textMuted}
                    />
                    {liveRate && (
                        <View style={styles.liveRateBadge}>
                            <Text style={styles.liveRateText}>1 {defaultCurrency} ≈ {liveRate.toFixed(2)} {baseCurrency}</Text>
                        </View>
                    )}
                </View>
            </View>


            {/* Logistics Section */}
            <View style={[styles.glassCard, { marginTop: 20 }]}>
                <Text style={styles.inputLabel}>CURRENCY & BUDGET</Text>
                <View style={styles.currencySelectorContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyScrollView}>
                        {isDetectingCurrency && (
                            <View style={styles.detectingChip}>
                                <ActivityIndicator size="small" color="#0EA5E9" />
                            </View>
                        )}
                        {availableCurrencies.map(c => (
                            <TouchableOpacity
                                key={c.value}
                                onPress={() => setBaseCurrency(c.value)}
                                style={[styles.premiumCurrencyChip, baseCurrency === c.value && styles.premiumCurrencyChipActive]}
                            >
                                <Text style={[styles.currencyFlag, baseCurrency === c.value && styles.currencyFlagActive]}>{c.label.split(' ')[0]}</Text>
                                <Text style={[styles.currencyCode, baseCurrency === c.value && styles.currencyCodeActive]}>{c.value}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={[styles.inputWrapper, { marginTop: 15 }]}>
                    <Ionicons name="cash-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                    <TextInput
                        style={styles.premiumInput}
                        value={budget}
                        onChangeText={setBudget}
                        keyboardType="numeric"
                        placeholder="Enter total budget (optional)"
                        placeholderTextColor={COLORS.textMuted}
                    />
                    <Text style={styles.currencySuffix}>{baseCurrency}</Text>
                </View>

                <Text style={[styles.inputLabel, { marginTop: 25 }]}>TRIP STATUS & DATES</Text>
                <View style={styles.statusToggleGroup}>
                    <TouchableOpacity
                        style={[styles.statusOption, tripStatus === 'Active' && styles.statusOptionActive]}
                        onPress={() => {
                            setTripStatus('Active');
                            setSelectingType('start');
                            setShowDatePicker(true);
                        }}
                    >
                        <LinearGradient
                            colors={tripStatus === 'Active' ? ['#0EA5E9', '#2DD4BF'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)']}
                            style={styles.statusIcon}
                        >
                            <Ionicons name="airplane" size={18} color={tripStatus === 'Active' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, tripStatus === 'Active' && styles.statusTitleActive]}>Travelling Now</Text>
                            <Text style={styles.statusSub}>{startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</Text>
                        </View>
                        {tripStatus === 'Active' && <Ionicons name="calendar-outline" size={16} color="#fff" style={{ opacity: 0.6 }} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.statusOption, tripStatus === 'Planning' && styles.statusOptionActive]}
                        onPress={() => {
                            setTripStatus('Planning');
                            setSelectingType('start');
                            setShowDatePicker(true);
                        }}
                    >
                        <LinearGradient
                            colors={tripStatus === 'Planning' ? ['#6366F1', '#A855F7'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)']}
                            style={styles.statusIcon}
                        >
                            <Ionicons name="calendar" size={18} color={tripStatus === 'Planning' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.statusTitle, tripStatus === 'Planning' && styles.statusTitleActive]}>Just Planning</Text>
                            <Text style={styles.statusSub}>Set date range</Text>
                        </View>
                        {tripStatus === 'Planning' && <Ionicons name="chevron-forward" size={16} color="#fff" style={{ opacity: 0.6 }} />}
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={styles.fullWidthAction}
                activeOpacity={0.8}
                onPress={() => {
                    if (!tripName.trim()) {
                        Alert.alert('Required', 'Please enter a trip name');
                        return;
                    }
                    setStep(2);
                }}
            >
                <LinearGradient
                    colors={['#0EA5E9', '#2DD4BF']}
                    style={styles.actionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={styles.actionButtonText}>Next: Add Travellers</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Simple Date Picker Modal */}
            <Modal visible={showDatePicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select {selectingType === 'start' ? 'Departure' : 'Return'} Date</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.calendarPlaceholder}>
                            <Ionicons name="calendar" size={64} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.calendarNote}>Select date for {selectingType === 'start' ? 'Departure' : 'Return'}</Text>

                            <View style={styles.dateSelectorGrid}>
                                {[7, 14, 21, 30].map(days => {
                                    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                                    return (
                                        <TouchableOpacity
                                            key={days}
                                            style={styles.dateQuickOption}
                                            onPress={() => {
                                                if (selectingType === 'start') setStartDate(d);
                                                else setEndDate(d);
                                                setShowDatePicker(false);
                                            }}
                                        >
                                            <Text style={styles.quickDay}>{d.getDate()}</Text>
                                            <Text style={styles.quickMonth}>{d.toLocaleString('default', { month: 'short' })}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setShowDatePicker(false)}
                        >
                            <Text style={styles.modalCloseText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );

    const renderStep2 = () => (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>ADDED TRAVELLERS</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{travellers.length}</Text>
                </View>
            </View>

            {travellers.map((t, i) => (
                <View key={i} style={styles.travellerGlassCard}>
                    <View style={[styles.travellerAvatar, { backgroundColor: t.color || '#0EA5E9' }]}>
                        <Text style={styles.travellerLetter}>{t.letter || (t.name ? t.name.substring(0, 1).toUpperCase() : '?')}</Text>
                    </View>
                    <View style={styles.travellerDetails}>
                        <Text style={styles.travellerNameText}>{t.name} {t.isYou ? '(You)' : ''}</Text>
                        <Text style={styles.travellerMetaText}>{t.email || 'No email provided'}</Text>
                        {t.paymentModes && t.paymentModes.length > 0 && (
                            <View style={styles.modesList}>
                                {t.paymentModes.map(m => (
                                    <View key={m} style={styles.tinyModeChip}>
                                        <Text style={styles.tinyModeText}>{m}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                    {t.isYou ? (
                        <View style={styles.organizerIndicator}>
                            <Ionicons name="crown" size={12} color="#F59E0B" />
                        </View>
                    ) : (
                        <TouchableOpacity onPress={() => removeTraveller(i)} style={styles.removeIconBtn}>
                            <Ionicons name="trash-outline" size={18} color="#F43F5E" />
                        </TouchableOpacity>
                    )}
                </View>
            ))}

            {showAddForm ? (
                <View style={styles.addTravellerGlassForm}>
                    <View style={styles.formIndicator} />
                    <Text style={styles.formHeading}>New Traveller</Text>

                    <View style={styles.inputWrapper}>
                        <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.premiumInput}
                            placeholder="Full Name"
                            placeholderTextColor={COLORS.textMuted}
                            value={newTraveller.name}
                            onChangeText={v => setNewTraveller({ ...newTraveller, name: v })}
                        />
                    </View>

                    <View style={[styles.inputWrapper, { marginTop: 12 }]}>
                        <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.premiumInput}
                            placeholder="Email (for syncing)"
                            placeholderTextColor={COLORS.textMuted}
                            value={newTraveller.email}
                            onChangeText={v => setNewTraveller({ ...newTraveller, email: v })}
                        />
                    </View>

                    <Text style={styles.formSubLabel}>Payment Access</Text>
                    <View style={styles.paymentModeGrid}>
                        {[
                            { id: 'Cash', icon: 'cash-outline', label: 'Cash' },
                            { id: 'Card', icon: 'card-outline', label: 'Card' },
                            { id: 'Digital', icon: 'wallet-outline', label: 'Digital' }
                        ].map(mode => (
                            <TouchableOpacity
                                key={mode.id}
                                onPress={() => togglePaymentMode(mode.id)}
                                style={[styles.modeToggle, newTraveller.paymentModes.includes(mode.id) && styles.modeToggleActive]}
                            >
                                <Ionicons
                                    name={mode.icon}
                                    size={16}
                                    color={newTraveller.paymentModes.includes(mode.id) ? '#fff' : COLORS.textSecondary}
                                />
                                <Text style={[styles.modeToggleText, newTraveller.paymentModes.includes(mode.id) && styles.modeToggleTextActive]}>
                                    {mode.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.formActionsRow}>
                        <TouchableOpacity style={styles.cancelAction} onPress={() => setShowAddForm(false)}>
                            <Text style={styles.cancelActionText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmAction, !newTraveller.name.trim() && { opacity: 0.5 }]}
                            onPress={addTraveller}
                            disabled={!newTraveller.name.trim()}
                        >
                            <LinearGradient colors={['#0EA5E9', '#2DD4BF']} style={styles.confirmGradient}>
                                <Text style={styles.confirmActionText}>Add to Trip</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <TouchableOpacity style={styles.addNewTrigger} onPress={() => setShowAddForm(true)}>
                    <View style={styles.addTriggerIcon}>
                        <Ionicons name="person-add-outline" size={24} color="#0EA5E9" />
                    </View>
                    <View>
                        <Text style={styles.addTriggerTitle}>Add someone else</Text>
                        <Text style={styles.addTriggerSub}>Friends, family, or partners</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
            )}

            <View style={styles.navigationRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
                    <Text style={styles.backButtonText}>Previous</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextButton} onPress={() => setStep(3)}>
                    <LinearGradient colors={['#0EA5E9', '#2DD4BF']} style={styles.nextGradient}>
                        <Text style={styles.nextButtonText}>Review ✨</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    const renderStep3 = () => (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Journey Summary Card */}
            <View style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                    <LinearGradient
                        colors={['#0EA5E9', '#2DD4BF']}
                        style={styles.ticketIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.ticketEmoji}>{selectedIcon}</Text>
                    </LinearGradient>
                    <View style={styles.ticketHeaderText}>
                        <Text style={styles.ticketTitle}>{tripName}</Text>
                        <View style={styles.locationTag}>
                            <Ionicons name="location" size={10} color="#38BDF8" />
                            <Text style={styles.locationTabText}>{destination || 'Worldwide'}</Text>
                        </View>
                    </View>
                    <View style={styles.ticketStatus}>
                        <Text style={styles.statusLabel}>STATUS</Text>
                        <Text style={styles.statusValue}>{tripStatus.toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.ticketDivider}>
                    <View style={styles.ticketCircleLeft} />
                    <View style={styles.ticketDashedLine} />
                    <View style={styles.ticketCircleRight} />
                </View>

                <View style={styles.ticketBody}>
                    <View style={styles.infoGrid}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>BUDGET</Text>
                            <Text style={styles.infoValue}>{budget ? `${baseCurrency} ${budget}` : 'No limit'}</Text>
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>DATES</Text>
                            <Text style={styles.infoValue}>Upcoming</Text>
                        </View>
                    </View>

                    <Text style={styles.travellersHeading}>TRAVELLERS ({travellers.length})</Text>
                    <View style={styles.travellerAvatarsGroup}>
                        {travellers.map((t, i) => (
                            <View key={i} style={[styles.travellerThumbnail, { backgroundColor: t.color || '#0EA5E9', zIndex: 10 - i }]}>
                                <Text style={styles.thumbnailText}>{t.letter}</Text>
                            </View>
                        ))}
                        {travellers.length > 5 && (
                            <View style={styles.moreTravellers}>
                                <Text style={styles.moreText}>+{travellers.length - 5}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.finalActionsRow}>
                <TouchableOpacity style={styles.editPathBtn} onPress={() => setStep(1)}>
                    <Ionicons name="options-outline" size={20} color="#fff" />
                    <Text style={styles.editPathText}>Edit Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.createFinalBtn}
                    onPress={handleCreateTrip}
                    disabled={isCreating}
                >
                    <LinearGradient colors={['#0EA5E9', '#2DD4BF']} style={styles.finalGradient}>
                        {isCreating ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.createFinalText}>Launch Trip</Text>
                                <Ionicons name="rocket" size={18} color="#fff" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    return (
        <View style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle="light-content" translucent />
            {renderHeader()}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Background Decoration */}
                <View style={[styles.bubble, { top: 100, right: -60, backgroundColor: COLORS.purpleBubble }]} />
                <View style={[styles.bubble, { top: 400, left: -80, width: 280, height: 280, backgroundColor: COLORS.cyanBubble }]} />

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    bubble: {
        position: 'absolute',
        borderRadius: 150,
        zIndex: 0,
        opacity: 0.15,
    },

    // Header
    header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30, position: 'relative', overflow: 'hidden' },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
    headerSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginTop: 2 },
    headerCircle: { position: 'absolute', borderRadius: 999 },

    // Step Indicator
    stepsIndicatorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30, zIndex: 10, paddingHorizontal: 10 },
    stepBubbleContainer: { alignItems: 'center', gap: 8 },
    stepBubble: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    stepBubbleActive: { backgroundColor: '#0EA5E9', borderColor: '#38BDF8' },
    stepBubbleCurrent: { transform: [{ scale: 1.1 }], shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 15, elevation: 10 },
    stepLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 10, marginBottom: 20 },
    stepLineActive: { backgroundColor: '#0EA5E9' },
    stepTabText: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    stepTabTextActive: { color: '#fff' },

    content: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },

    // Step UI Components
    glassCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5
    },
    inputLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 15 },

    // Icon Selection
    iconSelectionRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    selectedIconLargeContainer: {
        width: 80, height: 80, borderRadius: 24, padding: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10
    },
    selectedIconLarge: { flex: 1, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    selectedIconEmojiLarge: { fontSize: 40 },
    iconSelector: { flexDirection: 'row' },
    smallIconChip: {
        width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
    },
    smallIconChipActive: { borderColor: '#0EA5E9', backgroundColor: 'rgba(14, 165, 233, 0.15)' },
    smallIconEmoji: { fontSize: 24 },
    helperText: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 8, fontStyle: 'italic' },

    // Inputs
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center', height: 58,
        backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: 18,
        paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    inputIcon: { marginRight: 12 },
    premiumInput: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
    currencySuffix: { color: '#0EA5E9', fontWeight: '800', fontSize: 14, marginLeft: 10 },

    // Currency Selector
    currencySelectorContainer: { marginHorizontal: -24, marginBottom: 15 },
    currencyScrollView: { paddingHorizontal: 24, gap: 12 },
    premiumCurrencyChip: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
    },
    premiumCurrencyChipActive: { backgroundColor: 'rgba(14, 165, 233, 0.2)', borderColor: '#0EA5E9' },
    currencyFlag: { fontSize: 16, marginRight: 8, opacity: 0.6 },
    currencyFlagActive: { opacity: 1 },
    currencyCode: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700' },
    currencyCodeActive: { color: '#fff' },

    // Status Toggle
    statusToggleGroup: { flexDirection: 'row', gap: 12 },
    statusOption: {
        flex: 1, padding: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 12
    },
    statusOptionActive: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' },
    statusIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statusTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '700' },
    statusTitleActive: { color: '#fff' },
    statusSub: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 },

    // Step 2 Styles
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    sectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
    countBadge: { backgroundColor: 'rgba(14, 165, 233, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    countBadgeText: { color: '#0EA5E9', fontSize: 12, fontWeight: '800' },

    travellerGlassCard: {
        flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
    },
    travellerAvatar: { width: 50, height: 50, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    travellerLetter: { color: '#fff', fontSize: 18, fontWeight: '800' },
    travellerDetails: { flex: 1, marginLeft: 16 },
    travellerNameText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    travellerMetaText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
    modesList: { flexDirection: 'row', gap: 6, marginTop: 8 },
    tinyModeChip: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    tinyModeText: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700' },
    organizerIndicator: { padding: 6 },
    removeIconBtn: { padding: 6 },

    addTravellerGlassForm: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 24, borderRadius: 28,
        borderWidth: 1.5, borderColor: '#0EA5E9', marginTop: 10, marginBottom: 20,
        shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20
    },
    formIndicator: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    formHeading: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
    formSubLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 20, marginBottom: 12 },
    paymentModeGrid: { flexDirection: 'row', gap: 8 },
    modeToggle: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
    },
    modeToggleActive: { backgroundColor: '#0EA5E9', borderColor: '#38BDF8' },
    modeToggleText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' },
    modeToggleTextActive: { color: '#fff' },
    formActionsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
    cancelAction: { flex: 1, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    cancelActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    confirmAction: { flex: 1.5, height: 50, borderRadius: 16, overflow: 'hidden' },
    confirmGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    confirmActionText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    addNewTrigger: {
        flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 22,
        backgroundColor: 'rgba(14, 165, 233, 0.05)', borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'rgba(14, 165, 233, 0.3)',
        marginBottom: 30
    },
    addTriggerIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(14, 165, 233, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    addTriggerTitle: { color: '#38BDF8', fontSize: 15, fontWeight: '700' },
    addTriggerSub: { color: 'rgba(14, 165, 233, 0.5)', fontSize: 12, marginTop: 2 },

    // Step 3 Ticket
    ticketCard: {
        backgroundColor: '#1E293B', borderRadius: 32, overflow: 'hidden', padding: 0,
        shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 30, elevation: 10
    },
    ticketHeader: { padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
    ticketIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    ticketEmoji: { fontSize: 32 },
    ticketHeaderText: { flex: 1 },
    ticketTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
    locationTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    locationTabText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
    ticketStatus: { alignItems: 'flex-end' },
    statusLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
    statusValue: { color: '#10B981', fontSize: 12, fontWeight: '800', marginTop: 4 },

    ticketDivider: { height: 30, flexDirection: 'row', alignItems: 'center', position: 'relative' },
    ticketCircleLeft: { position: 'absolute', left: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: '#020617' },
    ticketCircleRight: { position: 'absolute', right: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: '#020617' },
    ticketDashedLine: { flex: 1, height: 1.5, backgroundColor: 'transparent', borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20 },

    ticketBody: { padding: 24 },
    infoGrid: { flexDirection: 'row', gap: 16, marginBottom: 25 },
    infoBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    infoLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', marginBottom: 6 },
    infoValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
    travellersHeading: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15 },
    travellerAvatarsGroup: { flexDirection: 'row', alignItems: 'center' },
    travellerThumbnail: { width: 36, height: 36, borderRadius: 12, borderWidth: 2, borderColor: '#1E293B', justifyContent: 'center', alignItems: 'center', marginLeft: -8 },
    thumbnailText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    moreTravellers: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: -8, borderWidth: 2, borderColor: '#1E293B' },
    moreText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800' },

    // Footer Actions
    fullWidthAction: { marginTop: 30 },
    actionGradient: { height: 62, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    actionButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },

    navigationRow: { flexDirection: 'row', gap: 15, marginTop: 10 },
    backButton: { flex: 1, height: 58, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    backButtonText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '700' },
    nextButton: { flex: 2, borderRadius: 20, overflow: 'hidden' },
    nextGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    finalActionsRow: { flexDirection: 'row', gap: 15, marginTop: 40 },
    editPathBtn: { flex: 1, height: 58, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    editPathText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    createFinalBtn: { flex: 2, height: 58, borderRadius: 20, overflow: 'hidden' },
    finalGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    createFinalText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
    detectingChip: {
        width: 60,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(14, 165, 233, 0.05)',
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.1)',
    },
    liveRateBadge: {
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.2)',
        position: 'absolute',
        right: 12,
    },
    liveRateText: { color: '#0EA5E9', fontSize: 11, fontWeight: '700' },

    // Dates Styles
    datesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15 },
    datePickerTrigger: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    dateLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    dateValue: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 },
    dateConnector: { width: 10, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

    // Modal Styles
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center', alignItems: 'center', padding: 20
    },
    modalContent: {
        backgroundColor: '#1E293B', width: '100%', borderRadius: 28, padding: 24,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    calendarPlaceholder: { alignItems: 'center', paddingVertical: 20 },
    calendarNote: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 12, textAlign: 'center' },
    dateSelectorGrid: { flexDirection: 'row', gap: 12, marginTop: 30, flexWrap: 'wrap', justifyContent: 'center' },
    dateQuickOption: {
        width: 60, height: 75, backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    quickDay: { color: '#fff', fontSize: 18, fontWeight: '800' },
    quickMonth: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', marginTop: 2 },
    modalCloseBtn: {
        backgroundColor: 'rgba(255,255,255,0.05)', padding: 16,
        borderRadius: 16, marginTop: 30, alignItems: 'center'
    },
    modalCloseText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
