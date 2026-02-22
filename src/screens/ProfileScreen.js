import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Image, Alert, ActivityIndicator,
    useColorScheme, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db, auth as firebaseAuth } from '../config/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { CURRENCIES, POPULAR_CODES } from '../constants/currencies';

const SectionHeader = ({ title, theme }) => (
    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
);

const POPULAR_CURRENCY_CODES = POPULAR_CODES;

const StatCard = ({ value, label, color, theme }) => (
    <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: color || '#fff' }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>{label}</Text>
    </View>
);

export default function ProfileScreen({ navigation }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DARK : LIGHT;

    const { user, logout } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [trips, setTrips] = useState([]);
    const [loadingTrips, setLoadingTrips] = useState(true);
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);
    const [currencySearch, setCurrencySearch] = useState('');
    const [isSavingCurrency, setIsSavingCurrency] = useState(false);

    const defaultCurrency = user?.defaultCurrency || 'USD';
    const currentCurrencyObj = CURRENCIES.find(c => c.code === defaultCurrency) || CURRENCIES[0];

    const filteredCurrencies = currencySearch.trim()
        ? CURRENCIES.filter(c =>
            c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
            c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
            c.country.toLowerCase().includes(currencySearch.toLowerCase())
        )
        : CURRENCIES;

    const popularCurrencies = filteredCurrencies.filter(c => POPULAR_CURRENCY_CODES.includes(c.code));
    const otherCurrencies = filteredCurrencies.filter(c => !POPULAR_CURRENCY_CODES.includes(c.code));

    const [totalSpent, setTotalSpent] = useState(0);

    useEffect(() => {
        if (!user) return;

        let unsub2 = null;
        const q1 = query(collection(db, 'trips'), where('travellerEmails', 'array-contains', user.email?.toLowerCase()));
        const q2 = query(collection(db, 'trips'), where('creatorId', '==', user.uid));

        const unsub1 = onSnapshot(q1, (snap1) => {
            const trips1 = snap1.docs.map(d => ({ id: d.id, ...d.data() }));

            if (unsub2) unsub2();

            unsub2 = onSnapshot(q2, (snap2) => {
                const trips2 = snap2.docs.map(d => ({ id: d.id, ...d.data() }));

                // Merge and dedup
                const merged = [...trips1];
                trips2.forEach(t => {
                    if (!merged.find(m => m.id === t.id)) merged.push(t);
                });

                merged.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setTrips(merged);

                let spent = 0;
                merged.forEach(trip => {
                    if (trip.status === 'Active') {
                        spent += (trip.totalSpent || 0);
                    }
                });
                setTotalSpent(spent);
                setLoadingTrips(false);
            }, (error) => {
                console.error('Error fetching creator trips:', error);
                setLoadingTrips(false);
            });
        }, (error) => {
            console.error('Error fetching shared trips:', error);
            setLoadingTrips(false);
        });

        return () => {
            if (unsub1) unsub1();
            if (unsub2) unsub2();
        };
    }, [user]);

    const handleLogout = async () => {
        try {
            await logout();
            navigation.replace('Login');
        } catch (error) {
            console.error('Logout Error:', error);
        }
    };

    const handleChangePassword = async () => {
        Alert.alert(
            'Change Password',
            'We will send a password reset link to your email. Do you want to proceed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Email',
                    onPress: async () => {
                        try {
                            await sendPasswordResetEmail(firebaseAuth, user.email);
                            Alert.alert('Success', 'Password reset email sent!');
                        } catch (error) {
                            console.error('Password Reset Error:', error);
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const updateDefaultCurrency = async (currencyCode) => {
        setIsSavingCurrency(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                defaultCurrency: currencyCode
            });
            // AuthContext onSnapshot will propagate user.defaultCurrency automatically
            setShowCurrencyModal(false);
            setCurrencySearch('');
        } catch (error) {
            console.error('Error updating currency:', error);
            Alert.alert('Error', 'Failed to update currency');
        } finally {
            setIsSavingCurrency(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" translucent />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Background Decoration */}
                <View style={[styles.bubble, { top: 200, left: -60, backgroundColor: COLORS.purpleBubble }]} />
                <View style={[styles.bubble, { top: 500, right: -80, width: 280, height: 280, backgroundColor: COLORS.cyanBubble }]} />

                {/* Header */}
                <LinearGradient
                    colors={['#0F172A', '#1E293B']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <View style={styles.circleTopRight} />

                    {/* Avatar */}
                    <View style={styles.avatarWrapper}>
                        <View style={styles.avatarContainer}>
                            {user?.photoURL ? (
                                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {user?.displayName ? user.displayName.substring(0, 1).toUpperCase() : (user?.email ? user.email.substring(0, 1).toUpperCase() : 'ME')}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Name */}
                    <View style={styles.nameRow}>
                        <Text style={styles.profileName}>{user?.displayName || 'Traveller'}</Text>
                        <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => navigation.navigate('EditProfile')}
                        >
                            <Ionicons name="pencil-outline" size={14} color="rgba(255,255,255,0.8)" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.emailRow}>
                        <Text style={styles.profileEmail}>{user?.email}</Text>
                        <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => navigation.navigate('EditProfile')}
                        >
                            <Ionicons name="pencil-outline" size={14} color="rgba(255,255,255,0.8)" />
                        </TouchableOpacity>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <StatCard value={trips.length} label="Trips" theme={theme} />
                        <View style={styles.statDivider} />
                        <StatCard value={`${defaultCurrency} ${totalSpent.toFixed(0)}`} label="Spent" theme={theme} />
                        <View style={styles.statDivider} />
                        <StatCard value="--" label="Owed" color="#2DD4BF" theme={theme} />
                    </View>
                </LinearGradient>

                {/* My Trips */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <SectionHeader title="MY TRIPS" theme={theme} />
                        <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Trips' })}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        {loadingTrips ? (
                            <ActivityIndicator color={COLORS.violet} style={{ padding: 20 }} />
                        ) : trips.length > 0 ? (
                            trips.slice(0, 2).map((trip, index, array) => (
                                <TouchableOpacity
                                    key={trip.id}
                                    style={[styles.tripItem, index !== array.length - 1 && styles.rowDivider, { borderBottomColor: theme.border }]}
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate('TripDetail', { trip })}
                                >
                                    <LinearGradient colors={['#0EA5E9', '#2DD4BF']} style={styles.tripIcon}>
                                        <Text style={{ fontSize: 20 }}>{trip.icon || '✈️'}</Text>
                                    </LinearGradient>
                                    <View style={styles.tripInfo}>
                                        <Text style={[styles.tripName, { color: theme.textPrimary }]}>{trip.name}</Text>
                                        <Text style={[styles.tripSubtitle, { color: theme.textSecondary }]}>{trip.status} · {trip.travellers?.length || 0} Members</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={{ padding: 30, alignItems: 'center' }}>
                                <Text style={{ color: theme.textMuted, fontSize: 14 }}>No trips created yet</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Travel Tools */}
                <View style={styles.section}>
                    <SectionHeader title="TRAVEL TOOLS" theme={theme} />
                    <View style={[styles.sectionCard]}>
                        <TouchableOpacity
                            style={[styles.settingRow, styles.rowDivider, { borderBottomColor: theme.border }]}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('CurrencyConverter')}
                        >
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(56, 189, 248, 0.1)' }]}>
                                <Ionicons name="calculator-outline" size={22} color="#38BDF8" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Currency Converter</Text>
                                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>Live exchange rates</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.settingRow}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('TripArchive')}
                        >
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(45, 212, 191, 0.1)' }]}>
                                <Ionicons name="archive-outline" size={22} color="#2DD4BF" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Trip Archive</Text>
                                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>View completed journeys</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Preferences */}
                <View style={styles.section}>
                    <SectionHeader title="PREFERENCES" theme={theme} />
                    <View style={[styles.sectionCard]}>
                        <TouchableOpacity
                            style={[styles.settingRow, styles.rowDivider, { borderBottomColor: theme.border }]}
                            activeOpacity={0.7}
                            onPress={() => setShowCurrencyModal(true)}
                        >
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                <Ionicons name="cash-outline" size={22} color="#10B981" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Default Currency</Text>
                                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                                    Currently {currentCurrencyObj.code} ({currentCurrencyObj.symbol})
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                                <Ionicons name="notifications-outline" size={22} color="#F59E0B" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Push Notifications</Text>
                                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>Enabled</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Payment Methods */}
                <View style={styles.section}>
                    <SectionHeader title="PAYMENT METHODS" theme={theme} />
                    <View style={[styles.sectionCard]}>
                        <View style={[styles.settingRow, styles.rowDivider, { borderBottomColor: theme.border }]}>
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                                <MaterialCommunityIcons name="flash" size={22} color="#F59E0B" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>UPI ID</Text>
                                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                                    {user?.upiId || 'Not configured'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
                                <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(0, 112, 186, 0.1)' }]}>
                                <Ionicons name="logo-paypal" size={22} color="#0070BA" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>PayPal Username</Text>
                                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                                    {user?.paypalId || 'Not configured'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
                                <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Account & Security */}
                <View style={styles.section}>
                    <SectionHeader title="ACCOUNT & SECURITY" theme={theme} />
                    <View style={[styles.sectionCard]}>
                        <TouchableOpacity
                            style={[styles.settingRow, styles.rowDivider, { borderBottomColor: theme.border }]}
                            activeOpacity={0.7}
                            onPress={handleChangePassword}
                        >
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(56, 189, 248, 0.1)' }]}>
                                <Ionicons name="lock-closed-outline" size={22} color="#38BDF8" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Change Password</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(244, 63, 94, 0.1)' }]}>
                                <Ionicons name="shield-checkmark-outline" size={22} color="#F43F5E" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Privacy Policy</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Support */}
                <View style={styles.section}>
                    <SectionHeader title="SUPPORT" theme={theme} />
                    <View style={[styles.sectionCard]}>
                        <TouchableOpacity style={[styles.settingRow, styles.rowDivider, { borderBottomColor: theme.border }]} activeOpacity={0.7}>
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                                <Ionicons name="help-buoy-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Help Center</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
                                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#0EA5E9" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Contact Support</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* App Info */}
                <View style={styles.section}>
                    <SectionHeader title="ABOUT" theme={theme} />
                    <View style={[styles.sectionCard]}>
                        <View style={styles.settingRow}>
                            <View style={[styles.settingIconWrapper, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                                <Ionicons name="information-circle-outline" size={22} color="#fff" />
                            </View>
                            <View style={styles.settingInfo}>
                                <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Version</Text>
                                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>v1.0.4 Platinum</Text>
                            </View>
                            <TouchableOpacity style={styles.updateBtn}>
                                <Text style={styles.updateBtnText}>Updated</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Log out */}
                <TouchableOpacity
                    style={styles.logoutBtn}
                    activeOpacity={0.7}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={24} color="#F43F5E" />
                    <Text style={styles.logoutText}>Sign out from BalanceBuddy</Text>
                </TouchableOpacity>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: theme.textMuted }]}>
                        Made with ❤️ for Travellers
                    </Text>
                </View>

                {/* Bottom Spacer */}
                <View style={{ height: 40 }} />
            </ScrollView >

            {/* Currency Modal - proper Modal component */}
            < Modal
                visible={showCurrencyModal}
                transparent
                animationType="slide"
                onRequestClose={() => { setShowCurrencyModal(false); setCurrencySearch(''); }
                }
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Select Currency</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                                    Current: {currentCurrencyObj.flag} {currentCurrencyObj.code} — {currentCurrencyObj.country}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => { setShowCurrencyModal(false); setCurrencySearch(''); }}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Search bar */}
                        <View style={styles.currencySearchBar}>
                            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.4)" />
                            <TextInput
                                style={styles.currencySearchInput}
                                placeholder="Search currency or country..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={currencySearch}
                                onChangeText={setCurrencySearch}
                                autoCapitalize="none"
                            />
                            {currencySearch.length > 0 && (
                                <TouchableOpacity onPress={() => setCurrencySearch('')}>
                                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                            {/* Popular section */}
                            {popularCurrencies.length > 0 && (
                                <>
                                    <Text style={styles.currencyGroupLabel}>⭐ POPULAR</Text>
                                    {popularCurrencies.map((item) => (
                                        <TouchableOpacity
                                            key={item.code}
                                            style={[styles.modalItem, defaultCurrency === item.code && styles.modalItemActive]}
                                            onPress={() => updateDefaultCurrency(item.code)}
                                            disabled={isSavingCurrency}
                                        >
                                            <Text style={styles.modalItemFlag}>{item.flag}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.modalItemCode}>{item.code}</Text>
                                                <Text style={styles.modalItemName}>{item.name} · {item.country}</Text>
                                            </View>
                                            {defaultCurrency === item.code && (
                                                <Ionicons name="checkmark-circle" size={20} color={COLORS.violet} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}

                            {/* All other currencies */}
                            {otherCurrencies.length > 0 && (
                                <>
                                    <Text style={styles.currencyGroupLabel}>🌍 ALL CURRENCIES</Text>
                                    {otherCurrencies.map((item) => (
                                        <TouchableOpacity
                                            key={item.code}
                                            style={[styles.modalItem, defaultCurrency === item.code && styles.modalItemActive]}
                                            onPress={() => updateDefaultCurrency(item.code)}
                                            disabled={isSavingCurrency}
                                        >
                                            <Text style={styles.modalItemFlag}>{item.flag}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.modalItemCode}>{item.code}</Text>
                                                <Text style={styles.modalItemName}>{item.name} · {item.country}</Text>
                                            </View>
                                            {defaultCurrency === item.code && (
                                                <Ionicons name="checkmark-circle" size={20} color={COLORS.violet} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}

                            {filteredCurrencies.length === 0 && (
                                <View style={{ alignItems: 'center', padding: 30 }}>
                                    <Ionicons name="search-outline" size={36} color="rgba(255,255,255,0.2)" />
                                    <Text style={{ color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>No currencies found</Text>
                                </View>
                            )}
                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal >
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { paddingBottom: 100 },
    bubble: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        zIndex: 0,
        opacity: 0.15,
    },
    header: { paddingTop: 60, paddingHorizontal: SPACING.base, paddingBottom: SPACING.xl, alignItems: 'center', overflow: 'hidden', position: 'relative', backgroundColor: COLORS.background },
    circleTopRight: { position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(56, 189, 248, 0.15)' },
    avatarWrapper: { position: 'relative', marginBottom: SPACING.md },
    avatarContainer: { width: 90, height: 90, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
    cameraBtn: { position: 'absolute', bottom: -4, right: -4, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.violet, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
    profileName: { color: '#fff', fontSize: 24, fontWeight: '700' },
    emailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
    profileEmail: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
    editBtn: { padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 },
    statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignSelf: 'stretch' },
    statCard: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 12, textAlign: 'center' },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: SPACING.sm },
    section: { marginHorizontal: SPACING.base, marginTop: 25, marginBottom: 5 },
    sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    seeAllText: { color: COLORS.violet, fontSize: 13, fontWeight: '700', marginRight: 4 },
    sectionCard: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden', backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255, 255, 255, 0.08)' },
    rowDivider: { borderBottomWidth: 1 },
    tripItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    tripIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    tripInfo: { flex: 1 },
    tripName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    tripSubtitle: { fontSize: 13 },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
    settingIconWrapper: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    settingInfo: { flex: 1 },
    settingTitle: { fontSize: 16, fontWeight: '600' },
    settingSubtitle: { fontSize: 12, marginTop: 2 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 12, marginTop: 10 },
    logoutText: { color: '#F43F5E', fontSize: 16, fontWeight: '700' },
    footer: { marginTop: 40, alignItems: 'center' },
    footerText: { fontSize: 12, fontWeight: '600' },
    updateBtn: { backgroundColor: 'rgba(45, 212, 191, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    updateBtnText: { color: '#2DD4BF', fontSize: 11, fontWeight: '700' },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end', alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#1E293B', width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: '88%'
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    modalList: { flexGrow: 0 },
    currencySearchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
    },
    currencySearchInput: { flex: 1, color: '#fff', fontSize: 14 },
    currencyGroupLabel: {
        color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800',
        letterSpacing: 1.5, marginBottom: 8, marginTop: 4, marginLeft: 4
    },
    modalItem: {
        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14,
        marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.03)'
    },
    modalItemActive: { backgroundColor: 'rgba(14, 165, 233, 0.1)', borderWidth: 1, borderColor: 'rgba(14, 165, 233, 0.3)' },
    modalItemFlag: { fontSize: 22, marginRight: 14 },
    modalItemCode: { color: '#fff', fontSize: 15, fontWeight: '700' },
    modalItemName: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
});
