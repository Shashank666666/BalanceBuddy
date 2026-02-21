import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
    Dimensions,
    useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');

const QuickAction = ({ icon, label, bgColor, onPress }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
        <View style={[styles.quickActionIcon, { backgroundColor: bgColor }]}>
            {icon}
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
);

const Avatar = ({ letter, color, style }) => (
    <View style={[styles.avatar, { backgroundColor: color }, style]}>
        <Text style={styles.avatarText}>{letter}</Text>
    </View>
);

export default function HomeScreen({ navigation }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DARK : LIGHT;

    const { user } = useAuth();
    const [latestTrip, setLatestTrip] = useState(null);
    const [activeCurrencies, setActiveCurrencies] = useState([]);
    const [liveRates, setLiveRates] = useState({});
    const [loading, setLoading] = useState(true);

    const defaultCurrency = user?.defaultCurrency || 'USD';

    useEffect(() => {
        if (!user) return;

        // Fetch all trips to find active ones and latest one
        const q = query(
            collection(db, 'trips'),
            where('creatorId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const allTrips = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Latest trip (Active first, then recent)
            const sorted = [...allTrips].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setLatestTrip(sorted[0]);

            // Currencies from all active trips
            const currencies = new Set();
            allTrips.forEach(trip => {
                if (trip.status === 'Active' && trip.baseCurrency) {
                    currencies.add(trip.baseCurrency);
                }
            });
            setActiveCurrencies(Array.from(currencies));

            setLoading(false);
        }, (error) => {
            console.error('Error fetching trips: ', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Fetch Live Rates for active currencies
    useEffect(() => {
        const fetchHomeRates = async () => {
            if (activeCurrencies.length === 0) {
                setLiveRates({});
                return;
            }

            const API_KEY = '0c65db1ed39247c720952a990c228cc4';
            try {
                // Fetch rates for the user's default currency
                const res = await fetch(`http://api.exchangerate.host/live?access_key=${API_KEY}&source=${defaultCurrency}`);
                const data = await res.json();

                if (data.success) {
                    const newRates = {};
                    activeCurrencies.forEach(curr => {
                        if (curr === defaultCurrency) return;
                        const quoteKey = `${defaultCurrency}${curr}`;
                        const rate = data.quotes[quoteKey];
                        if (rate) newRates[curr] = rate;
                    });
                    setLiveRates(newRates);
                }
            } catch (err) {
                console.log('Home rates fetch failed:', err);
            }
        };

        fetchHomeRates();
        const interval = setInterval(fetchHomeRates, 300000); // 5 mins
        return () => clearInterval(interval);
    }, [activeCurrencies, defaultCurrency]);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Header Decoration Bubbles */}
                <View style={[styles.bubble, { top: 120, right: -50, backgroundColor: COLORS.purpleBubble }]} />
                <View style={[styles.bubble, { top: 350, left: -60, width: 250, height: 250, backgroundColor: COLORS.cyanBubble }]} />
                <View style={[styles.bubble, { bottom: 100, right: -40, width: 200, height: 200, backgroundColor: COLORS.purpleBubble, opacity: 0.1 }]} />

                {/* Header */}
                <LinearGradient
                    colors={['#0F172A', '#1E293B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <View style={styles.circleTopRight} />
                    <View style={styles.circleBottomLeft} />

                    {/* Top Row */}
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.greetingText}>Good evening 🤙</Text>
                            <Text style={styles.greetingName}>{user?.email?.split('@')[0] || 'Traveller'}</Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.notifBtn}>
                                <Ionicons name="notifications-outline" size={22} color="#fff" />
                                <View style={styles.notifBadge}>
                                    <Text style={styles.notifBadgeText}>4</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Balance Card */}
                    <View style={styles.balanceCard}>
                        <Text style={styles.balanceLabel}>Your Balance</Text>
                        <Text style={styles.balanceAmount}>+$0.00</Text>
                        <View style={styles.balanceFooter}>
                            <View style={styles.balanceLeftInfo}>
                                <MaterialCommunityIcons
                                    name="currency-usd"
                                    size={14}
                                    color={COLORS.greenLight}
                                />
                                <Text style={styles.balancePeopleOwe}>People owe you</Text>
                            </View>
                            <Text style={styles.pendingSettlements}>0 pending{'\n'}settlements</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Quick Actions */}
                <View style={styles.quickActionsCard}>
                    <QuickAction
                        icon={<Ionicons name="add" size={24} color="#fff" />}
                        label="Add Expense"
                        bgColor="#7C3AED"
                    />
                    <QuickAction
                        icon={<Ionicons name="people-outline" size={24} color="#fff" />}
                        label="My Trips"
                        bgColor="#A855F7"
                        onPress={() => navigation.navigate('Trips')}
                    />
                    <QuickAction
                        icon={<MaterialCommunityIcons name="wallet-outline" size={24} color="#fff" />}
                        label="Settle Up"
                        bgColor="#38BDF8"
                    />
                    <QuickAction
                        icon={<FontAwesome5 name="globe" size={20} color="#fff" />}
                        label="Live Rates"
                        bgColor="#2DD4BF"
                    />
                </View>

                {/* Active Trip Card */}
                {loading ? (
                    <View style={[styles.tripCard, { padding: 40, alignItems: 'center' }]}>
                        <ActivityIndicator color={COLORS.brand} />
                    </View>
                ) : latestTrip ? (
                    <TouchableOpacity
                        style={styles.tripCard}
                        onPress={() => navigation.navigate('TripDetail', { trip: latestTrip })}
                    >
                        {/* Trip Header */}
                        <View style={styles.tripRow}>
                            <View style={styles.tripIconWrapper}>
                                <LinearGradient
                                    colors={['#0EA5E9', '#2DD4BF']}
                                    style={styles.tripIcon}
                                >
                                    <Text style={styles.tripIconEmoji}>{latestTrip.icon || '✈️'}</Text>
                                </LinearGradient>
                            </View>
                            <View style={styles.tripInfo}>
                                <View style={styles.tripTitleRow}>
                                    <Text style={styles.tripName}>{latestTrip.name}</Text>
                                    <View style={styles.activeBadge}>
                                        <Text style={styles.activeBadgeText}>{latestTrip.status}</Text>
                                    </View>
                                </View>
                                <Text style={styles.tripLocation}>{latestTrip.destination || 'No location'}</Text>
                                <View style={styles.tripMetaRow}>
                                    <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
                                    <Text style={styles.tripMeta}> {latestTrip.travellers?.length || 0} travellers</Text>
                                    <Text style={styles.tripMeta}> · {latestTrip.baseCurrency} {latestTrip.totalSpent || 0} total</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                        </View>

                        {/* Avatars */}
                        <View style={styles.avatarGroupRow}>
                            <View style={styles.avatarGroup}>
                                {latestTrip.travellers?.slice(0, 3).map((t, i) => (
                                    <Avatar
                                        key={i}
                                        letter={t.letter}
                                        color={t.color}
                                        style={i > 0 ? styles.avatarOverlap : {}}
                                    />
                                ))}
                            </View>
                            <Text style={styles.travellingTogether}>Travelling together</Text>
                        </View>

                        {/* Budget Progress */}
                        <View style={styles.progressSection}>
                            <View style={styles.progressLabelRow}>
                                <Text style={styles.progressLabel}>Budget used</Text>
                                <Text style={styles.progressPercent}>{Math.round((latestTrip.totalSpent / (latestTrip.budget || 1)) * 100)}%</Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${Math.min((latestTrip.totalSpent / (latestTrip.budget || 1)) * 100, 100)}%` }]} />
                            </View>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.noTripCard}
                        onPress={() => navigation.navigate('CreateTrip')}
                    >
                        <View style={styles.noTripIcon}>
                            <Ionicons name="airplane-outline" size={32} color="#38BDF8" />
                        </View>
                        <Text style={styles.noTripTitle}>No active trips</Text>
                        <Text style={styles.noTripSubtitle}>Ready for your next adventure?</Text>
                        <View style={[styles.noTripBtn, { backgroundColor: '#38BDF8' }]}>
                            <Text style={styles.noTripBtnText}>Plan a Trip</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Live Rates Footer */}
                <View style={styles.liveRatesSection}>
                    <View style={styles.liveRatesHeader}>
                        <View style={styles.liveRatesDot} />
                        <Text style={styles.liveRatesHeaderTitle}>ONGOING TRIP RATES ({defaultCurrency})</Text>
                    </View>

                    {Object.keys(liveRates).length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ratesScroll}>
                            {Object.entries(liveRates).map(([curr, rate]) => (
                                <View key={curr} style={styles.rateCard}>
                                    <Text style={styles.rateCurr}>{curr}</Text>
                                    <Text style={styles.rateValue}>{rate.toFixed(3)}</Text>
                                    <Text style={styles.rateTrend}>+0.00%</Text>
                                </View>
                            ))}
                        </ScrollView>
                    ) : (
                        <View style={styles.noRatesContainer}>
                            <Text style={styles.noRatesText}>
                                {activeCurrencies.length > 0
                                    ? `Fetching rates for ${activeCurrencies.join(', ')}...`
                                    : 'Add active trips to see live rates here'}
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    // No Trip Card
    noTripCard: {
        backgroundColor: COLORS.cardBg,
        marginHorizontal: SPACING.sm,
        marginTop: SPACING.md,
        borderRadius: RADIUS.lg,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(124, 58, 237, 0.3)',
    },
    noTripIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    noTripTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    noTripSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 14,
        marginBottom: 20,
    },
    noTripBtn: {
        backgroundColor: COLORS.violet,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: RADIUS.full,
    },
    noTripBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },

    // Header gradient
    header: {
        paddingTop: 55,
        paddingHorizontal: SPACING.base,
        paddingBottom: 60,
        position: 'relative',
        overflow: 'hidden',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    bubble: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        zIndex: 0,
        opacity: 0.2, // Blend with background
    },
    circleTopRight: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
    },
    circleBottomLeft: {
        position: 'absolute',
        bottom: -40,
        right: 60,
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(45, 212, 191, 0.1)',
    },

    // Top row
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.base,
        zIndex: 1,
    },
    greetingText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: FONTS.sizes.md,
    },
    greetingName: {
        color: '#fff',
        fontSize: FONTS.sizes.xxl,
        fontWeight: '800',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    notifBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    notifBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: COLORS.red,
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notifBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
    },
    meAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    meAvatarText: {
        color: '#fff',
        fontSize: FONTS.sizes.sm,
        fontWeight: '700',
    },

    // Balance Card
    balanceCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: RADIUS.xl,
        padding: SPACING.base,
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        zIndex: 1,
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: FONTS.sizes.sm,
        marginBottom: SPACING.xs,
    },
    balanceAmount: {
        color: '#fff',
        fontSize: FONTS.sizes.xxxl,
        fontWeight: '800',
        marginBottom: SPACING.sm,
    },
    balanceFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    balanceLeftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    balancePeopleOwe: {
        color: COLORS.greenLight,
        fontSize: FONTS.sizes.sm,
        fontWeight: '500',
    },
    pendingSettlements: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: FONTS.sizes.xs,
        textAlign: 'right',
    },

    // Quick Actions
    quickActionsCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        marginHorizontal: SPACING.sm,
        marginTop: -20,
        borderRadius: RADIUS.lg,
        padding: SPACING.base,
        justifyContent: 'space-around',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 2,
    },
    quickAction: {
        alignItems: 'center',
        gap: SPACING.xs,
    },
    quickActionIcon: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    quickActionLabel: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.xs,
        textAlign: 'center',
        fontWeight: '500',
    },

    // Trip Card
    tripCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        marginHorizontal: SPACING.sm,
        marginTop: SPACING.md,
        borderRadius: RADIUS.lg,
        padding: SPACING.base,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    tripRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.md,
    },
    tripIconWrapper: {
        marginRight: SPACING.md,
    },
    tripIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tripIconEmoji: {
        fontSize: 22,
    },
    tripInfo: {
        flex: 1,
    },
    tripTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: 2,
    },
    tripName: {
        color: COLORS.textPrimary,
        fontSize: FONTS.sizes.base,
        fontWeight: '700',
    },
    activeBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderRadius: RADIUS.full,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: COLORS.green,
    },
    activeBadgeText: {
        color: COLORS.green,
        fontSize: FONTS.sizes.xs,
        fontWeight: '600',
    },
    tripLocation: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.sm,
        marginBottom: 4,
    },
    tripMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tripMeta: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.sm,
    },

    // Avatars
    avatarGroupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        paddingBottom: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    avatarGroup: {
        flexDirection: 'row',
        marginRight: SPACING.sm,
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.cardBg,
    },
    avatarText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
    },
    avatarOverlap: {
        marginLeft: -8,
    },
    travellingTogether: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.sm,
    },

    // Progress
    progressSection: {},
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xs,
    },
    progressLabel: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.sm,
    },
    progressPercent: {
        color: COLORS.green,
        fontSize: FONTS.sizes.sm,
        fontWeight: '600',
    },
    progressBarBg: {
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: RADIUS.full,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.green,
        borderRadius: RADIUS.full,
    },

    // Live Rates
    liveRatesSection: {
        marginHorizontal: SPACING.sm,
        marginTop: SPACING.lg,
        paddingBottom: 20
    },
    liveRatesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 15,
        marginLeft: 4
    },
    liveRatesDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.green,
        shadowColor: COLORS.green,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    liveRatesHeaderTitle: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.5
    },
    ratesScroll: {
        flexDirection: 'row',
    },
    rateCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        marginRight: 10,
        minWidth: 100,
    },
    rateCurr: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 4
    },
    rateValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    rateTrend: {
        color: COLORS.green,
        fontSize: 10,
        fontWeight: '700',
        marginTop: 4
    },
    noRatesContainer: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderStyle: 'dashed'
    },
    noRatesText: {
        color: COLORS.textMuted,
        fontSize: 12,
        fontWeight: '500'
    },
});
