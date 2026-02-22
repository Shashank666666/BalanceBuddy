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
    const [selectedIcon, setSelectedIcon] = useState('🗼');
    const [tripStatus, setTripStatus] = useState('Active');

    // Dates
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectingType, setSelectingType] = useState('start'); // 'start' or 'end'
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    // Exchange Rate
    const [liveRate, setLiveRate] = useState(null);
    const defaultCurrency = user?.defaultCurrency || 'USD';



    // State for Travellers
    const [travellers, setTravellers] = useState([]);

    useEffect(() => {
        if (user && travellers.length === 0) {
            const userName = user.displayName || user.email?.split('@')[0] || 'You';
            setTravellers([{
                name: userName,
                email: user.email || '',
                color: COLORS.avatarM,
                letter: userName.substring(0, 2).toUpperCase()
            }]);
        }
    }, [user]);

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
        const t = travellers[index];
        const isMe = t.email && t.email.toLowerCase() === user.email?.toLowerCase();
        if (!isMe) {
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
                icon: selectedIcon,
                status: tripStatus,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                travellers: travellers,
                travellerEmails: travellers.map(t => t.email?.toLowerCase()).filter(e => e),
                creatorId: user.uid,
                createdAt: serverTimestamp(),
                destination: 'No location',
                baseCurrency: user.defaultCurrency || 'USD',
                totalSpent: 0,
                budget: 0,
            };

            const docRef = await addDoc(collection(db, 'trips'), tripData);
            console.log('Trip created with ID: ', docRef.id);
            navigation.replace('TripDetail', { trip: { id: docRef.id, ...tripData } });
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
                        placeholder="e.g. Euro Trip 2026"
                        placeholderTextColor={COLORS.textMuted}
                    />
                </View>
            </View>

            {/* Status & Dates Section */}
            <View style={[styles.glassCard, { marginTop: 20 }]}>
                <Text style={styles.inputLabel}>TRIP DATES</Text>
                <View style={styles.datePickerRow}>
                    <TouchableOpacity
                        style={[styles.dateSelectionBox, selectingType === 'start' && styles.dateSelectionBoxActive]}
                        onPress={() => {
                            setSelectingType('start');
                            setShowDatePicker(true);
                        }}
                    >
                        <Text style={styles.dateTypeLabel}>START DATE</Text>
                        <Text style={styles.dateValueText}>
                            {startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </Text>
                        <Ionicons name="calendar-outline" size={14} color={selectingType === 'start' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                    </TouchableOpacity>

                    <View style={styles.dateDivider}>
                        <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.2)" />
                    </View>

                    <TouchableOpacity
                        style={[styles.dateSelectionBox, selectingType === 'end' && styles.dateSelectionBoxActive]}
                        onPress={() => {
                            setSelectingType('end');
                            setShowDatePicker(true);
                        }}
                    >
                        <Text style={styles.dateTypeLabel}>END DATE</Text>
                        <Text style={styles.dateValueText}>
                            {endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </Text>
                        <Ionicons name="calendar-outline" size={14} color={selectingType === 'end' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.inputGroup, { marginTop: 20 }]}>
                    <Text style={styles.inputLabel}>TRIP STATUS</Text>
                    <View style={styles.statusToggleGrid}>
                        <TouchableOpacity
                            style={[styles.statusToggleBtn, tripStatus === 'Active' && styles.statusToggleBtnActive]}
                            onPress={() => setTripStatus('Active')}
                        >
                            <Ionicons name="airplane" size={16} color={tripStatus === 'Active' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                            <Text style={[styles.statusToggleText, tripStatus === 'Active' && styles.statusToggleTextActive]}>Travelling</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.statusToggleBtn, tripStatus === 'Planning' && styles.statusToggleBtnActive]}
                            onPress={() => setTripStatus('Planning')}
                        >
                            <Ionicons name="map" size={16} color={tripStatus === 'Planning' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                            <Text style={[styles.statusToggleText, tripStatus === 'Planning' && styles.statusToggleTextActive]}>Planning</Text>
                        </TouchableOpacity>
                    </View>
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

            {/* Premium Date Picker Modal */}
            <Modal visible={showDatePicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>
                                    {selectingType === 'start' ? 'Start Date' : 'End Date'}
                                </Text>
                                <Text style={styles.modalSubtitle}>
                                    {selectingType === 'start' ? 'When does the journey begin?' : 'When are you heading back?'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Calendar Component */}
                        <View style={styles.calendarContainer}>
                            <View style={styles.calendarHeader}>
                                <TouchableOpacity
                                    onPress={() => {
                                        let m = currentMonth - 1;
                                        let y = currentYear;
                                        if (m < 0) { m = 11; y--; }
                                        setCurrentMonth(m);
                                        setCurrentYear(y);
                                    }}
                                    style={styles.navBtn}
                                >
                                    <Ionicons name="chevron-back" size={20} color="#fff" />
                                </TouchableOpacity>
                                <Text style={styles.monthLabel}>
                                    {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        let m = currentMonth + 1;
                                        let y = currentYear;
                                        if (m > 11) { m = 0; y++; }
                                        setCurrentMonth(m);
                                        setCurrentYear(y);
                                    }}
                                    style={styles.navBtn}
                                >
                                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.weekDaysRow}>
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                    <Text key={i} style={styles.weekDayText}>{d}</Text>
                                ))}
                            </View>

                            <View style={styles.daysGrid}>
                                {(() => {
                                    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
                                    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                                    const days = [];

                                    for (let i = 0; i < firstDay; i++) {
                                        days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
                                    }

                                    for (let d = 1; d <= daysInMonth; d++) {
                                        const dateObj = new Date(currentYear, currentMonth, d);
                                        const isSelected = selectingType === 'start'
                                            ? startDate.toDateString() === dateObj.toDateString()
                                            : endDate.toDateString() === dateObj.toDateString();
                                        const isToday = new Date().toDateString() === dateObj.toDateString();

                                        days.push(
                                            <TouchableOpacity
                                                key={d}
                                                style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                                                onPress={() => {
                                                    if (selectingType === 'start') {
                                                        setStartDate(dateObj);
                                                        if (endDate < dateObj) setEndDate(new Date(dateObj.getTime() + 7 * 24 * 60 * 60 * 1000));
                                                    } else {
                                                        if (dateObj < startDate) {
                                                            Alert.alert('Invalid Date', 'End date cannot be before start date');
                                                            return;
                                                        }
                                                        setEndDate(dateObj);
                                                    }
                                                    setShowDatePicker(false);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.dayText,
                                                    isSelected && styles.dayTextSelected,
                                                    isToday && !isSelected && styles.dayTextToday
                                                ]}>{d}</Text>
                                                {isToday && !isSelected && <View style={styles.todayIndicator} />}
                                            </TouchableOpacity>
                                        );
                                    }
                                    return days;
                                })()}
                            </View>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.confirmModalBtn}
                                onPress={() => setShowDatePicker(false)}
                            >
                                <LinearGradient colors={['#0EA5E9', '#2DD4BF']} style={styles.confirmModalGradient}>
                                    <Text style={styles.confirmModalText}>Confirm Date</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
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
                            <MaterialCommunityIcons name="crown" size={14} color="#F59E0B" />
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
                            <Ionicons name="calendar" size={10} color="#38BDF8" />
                            <Text style={styles.locationTabText}>
                                {startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - {endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </Text>
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
                            <Text style={styles.infoLabel}>DESTINATIONS</Text>
                            <Text style={styles.infoValue}>Add after creating</Text>
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>DATES</Text>
                            <Text style={styles.infoValue}>
                                {Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))} days
                            </Text>
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
    // Date Picker Row (New)
    datePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    dateSelectionBox: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: 4,
    },
    dateSelectionBoxActive: {
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        borderColor: 'rgba(14, 165, 233, 0.4)',
    },
    dateTypeLabel: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1,
    },
    dateValueText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    dateDivider: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Status Toggle Grid (New)
    statusToggleGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statusToggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 54,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statusToggleBtnActive: {
        backgroundColor: '#0EA5E9',
        borderColor: '#38BDF8',
    },
    statusToggleText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        fontWeight: '700',
    },
    statusToggleTextActive: {
        color: '#fff',
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
        flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center', alignItems: 'center', padding: 20
    },
    modalContent: {
        backgroundColor: '#1E293B', width: '100%', borderRadius: 32, padding: 24,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5, shadowRadius: 30, elevation: 20
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
    modalSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4, fontWeight: '500' },
    modalCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },

    calendarContainer: { marginTop: 10 },
    calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 },
    navBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    monthLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },

    weekDaysRow: { flexDirection: 'row', marginBottom: 15 },
    weekDayText: { flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '800' },

    daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: '14.28%', height: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderRadius: 12, position: 'relative' },
    dayCellSelected: { backgroundColor: '#0EA5E9' },
    dayText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    dayTextSelected: { color: '#fff', fontWeight: '800' },
    dayTextToday: { color: '#0EA5E9', fontWeight: '800' },
    todayIndicator: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: '#0EA5E9' },

    modalFooter: { marginTop: 24 },
    confirmModalBtn: { height: 56, borderRadius: 16, overflow: 'hidden' },
    confirmModalGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    confirmModalText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
