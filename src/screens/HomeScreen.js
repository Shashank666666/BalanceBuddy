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
    Modal,
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
    const [loading, setLoading] = useState(true);
    const [showTripPicker, setShowTripPicker] = useState(false);
    const [allTrips, setAllTrips] = useState([]);
    const [userBalance, setUserBalance] = useState(0);

    const defaultCurrency = user?.defaultCurrency || 'USD';

    useEffect(() => {
        if (!user) return;

        let unsub2 = null;

        // Query trips where user is a traveller
        const q1 = query(
            collection(db, 'trips'),
            where('travellerEmails', 'array-contains', user.email?.toLowerCase())
        );

        // Query trips where user is the creator (legacy/backup)
        const q2 = query(
            collection(db, 'trips'),
            where('creatorId', '==', user.uid)
        );

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

                setAllTrips(merged);

                const activeOnes = merged.filter(t => t.status === 'Active' || t.status === 'Planning');
                const sorted = [...activeOnes].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setLatestTrip(sorted[0] || null);

                setLoading(false);
            }, (error) => {
                console.error('Error fetching creator trips:', error);
                setLoading(false);
            });
        }, (error) => {
            console.error('Error fetching shared trips:', error);
            setLoading(false);
        });

        return () => {
            if (unsub1) unsub1();
            if (unsub2) unsub2();
        };
    }, [user]);

    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user?.uid || allTrips.length === 0) {
            setUnreadCount(0);
            return;
        }

        // If lastCheckedActivities is null, it's likely syncing from serverTimestamp()
        // In that case, we should treat it as "now" (0 unread) to avoid a flash of unread counts
        const lastChecked = user.lastCheckedActivities?.seconds || (user.lastCheckedActivities === null ? (Date.now() / 1000) : 0);

        const unsubs = [];
        const counts = {};
        const destUnsubsMap = new Map(); // Track nested listeners

        allTrips.forEach(trip => {
            // 1. Direct expenses
            const qDirect = query(collection(db, 'trips', trip.id, 'expenses'));
            unsubs.push(onSnapshot(qDirect, (snap) => {
                const newOnes = snap.docs.filter(d => {
                    const data = d.data();
                    if (data.paidBy === user.uid) return false;
                    const createdSecs = data.createdAt?.seconds;
                    if (!createdSecs) return false;
                    return createdSecs > lastChecked;
                }).length;

                counts[`${trip.id}_direct`] = newOnes;
                setUnreadCount(Object.values(counts).reduce((a, b) => a + b, 0));
            }));

            // 2. Destination expenses
            const qDest = collection(db, 'trips', trip.id, 'destinations');
            unsubs.push(onSnapshot(qDest, (destSnap) => {
                const currentDestIds = destSnap.docs.map(d => d.id);

                // Cleanup removed destinations for this trip
                destUnsubsMap.forEach((unsub, key) => {
                    if (key.startsWith(`${trip.id}_`) && !currentDestIds.includes(key.split('_')[1])) {
                        unsub();
                        destUnsubsMap.delete(key);
                        delete counts[key];
                    }
                });

                destSnap.docs.forEach(destDoc => {
                    const destId = destDoc.id;
                    const key = `${trip.id}_${destId}`;

                    if (!destUnsubsMap.has(key)) {
                        const unsub = onSnapshot(query(collection(db, 'trips', trip.id, 'destinations', destId, 'expenses')), (expSnap) => {
                            const newOnes = expSnap.docs.filter(d => {
                                const data = d.data();
                                if (data.paidBy === user.uid) return false;
                                const createdSecs = data.createdAt?.seconds;
                                if (!createdSecs) return false;
                                return createdSecs > lastChecked;
                            }).length;

                            counts[key] = newOnes;
                            setUnreadCount(Object.values(counts).reduce((a, b) => a + b, 0));
                        }, (err) => console.error(`Dest count error [${destId}]:`, err));
                        destUnsubsMap.set(key, unsub);
                    }
                });
            }));
        });

        return () => {
            unsubs.forEach(u => u());
            destUnsubsMap.forEach(u => u());
        };
    }, [allTrips, user?.lastCheckedActivities, user?.uid]);

    useEffect(() => {
        if (!latestTrip?.id || !user) {
            setUserBalance(0);
            return;
        }

        const q = query(collection(db, 'trips', latestTrip.id, 'expenses'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const expenses = snapshot.docs.map(doc => doc.data());

            // Find my nickname in this trip
            const meInTrip = latestTrip.travellers?.find(t =>
                t.email && t.email.toLowerCase() === user.email?.toLowerCase()
            );
            const myNickname = meInTrip?.name;
            const myId = user.uid;

            let net = 0;
            expenses.forEach(exp => {
                const { amount, paidByNickname, splitWith, paidBy } = exp;
                if (!amount || !splitWith || splitWith.length === 0) return;

                const perHead = amount / splitWith.length;

                // I paid
                if (paidBy === myId || (myNickname && paidByNickname === myNickname) || paidByNickname === 'You') {
                    net += amount;
                }

                // I'm in the split
                if (splitWith.includes('You') || (myNickname && splitWith.includes(myNickname))) {
                    net -= perHead;
                }
            });
            setUserBalance(net);
        });

        return () => unsubscribe();
    }, [latestTrip?.id, user]);


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
                            <Text style={styles.greetingText}>Welcome back 👋</Text>
                            <Text style={styles.greetingName}>{user?.email?.split('@')[0] || 'Traveller'}</Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={styles.notifBtn}
                                onPress={() => {
                                    setUnreadCount(0); // Optimistic reset
                                    navigation.navigate('Activity');
                                }}
                            >
                                <Ionicons name="notifications-outline" size={22} color="#fff" />
                                {unreadCount > 0 && (
                                    <View style={styles.notifBadge}>
                                        <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Balance Card */}
                    <View style={styles.balanceCard}>
                        {(() => {
                            const tripCurrency = latestTrip?.baseCurrency || defaultCurrency;
                            const isPositive = userBalance >= 0;

                            return (
                                <>
                                    <Text style={styles.balanceLabel}>Your Balance ({tripCurrency})</Text>
                                    <Text style={[styles.balanceAmount, { color: isPositive ? '#fff' : '#ef4444' }]}>
                                        {isPositive ? '+' : '-'}{tripCurrency} {Math.abs(userBalance).toFixed(2)}
                                    </Text>
                                    <View style={styles.balanceFooter}>
                                        <View style={styles.balanceLeftInfo}>
                                            <MaterialCommunityIcons
                                                name={isPositive ? "currency-usd" : "alert-circle-outline"}
                                                size={14}
                                                color={isPositive ? COLORS.greenLight : '#ef4444'}
                                            />
                                            <Text style={[styles.balancePeopleOwe, !isPositive && { color: '#ef4444' }]}>
                                                {userBalance === 0 ? 'All settled up!' : (isPositive ? 'People owe you' : 'You owe people')}
                                            </Text>
                                        </View>
                                        <Text style={styles.pendingSettlements}>
                                            Based on latest trip
                                        </Text>
                                    </View>
                                </>
                            );
                        })()}
                    </View>
                </LinearGradient>

                {/* Quick Actions */}
                <View style={styles.quickActionsCard}>
                    <QuickAction
                        icon={<Ionicons name="add" size={24} color="#fff" />}
                        label="Add Expense"
                        bgColor="#7C3AED"
                        onPress={() => setShowTripPicker(true)}
                    />
                    <QuickAction
                        icon={<Ionicons name="people-outline" size={24} color="#fff" />}
                        label="My Trips"
                        bgColor="#A855F7"
                        onPress={() => navigation.navigate('MainTabs', { screen: 'Trips' })}
                    />
                    <QuickAction
                        icon={<FontAwesome5 name="globe" size={20} color="#fff" />}
                        label="Live Rates"
                        bgColor="#2DD4BF"
                        onPress={() => navigation.navigate('CurrencyConverter', {
                            fromCurr: defaultCurrency,
                            toCurr: latestTrip?.baseCurrency || 'EUR'
                        })}
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

                        {/* Travelling Status */}
                        <View style={{ marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: latestTrip.status === 'Active' ? '#10B981' : '#A78BFA' }} />
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>
                                {latestTrip.status === 'Active' ? 'Happening now' : 'Planned adventure'}
                            </Text>
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

            </ScrollView>

            {/* Trip Picker Modal */}
            <Modal visible={showTripPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Trip</Text>
                            <TouchableOpacity onPress={() => setShowTripPicker(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {allTrips.filter(t => t.status === 'Active').map(trip => (
                                <TouchableOpacity
                                    key={trip.id}
                                    style={styles.tripSelectItem}
                                    onPress={() => {
                                        setShowTripPicker(false);
                                        navigation.navigate('TripDetail', { trip, openAddExpense: true });
                                    }}
                                >
                                    <Text style={styles.tripSelectEmoji}>{trip.icon || '✈️'}</Text>
                                    <View>
                                        <Text style={styles.tripSelectName}>{trip.name}</Text>
                                        <Text style={styles.tripSelectDest}>{trip.destination || 'No destination'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {allTrips.filter(t => t.status === 'Active').length === 0 && (
                                <Text style={styles.noActiveTripsText}>No active trips found. Start a trip first!</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View >
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
    rateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    rateCurr: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '700',
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
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1E293B',
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        padding: SPACING.lg,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
    },
    tripSelectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: RADIUS.md,
        marginBottom: SPACING.sm,
    },
    tripSelectEmoji: {
        fontSize: 24,
        marginRight: SPACING.md,
    },
    tripSelectName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    tripSelectDest: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    noActiveTripsText: {
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginVertical: 20,
    }
});
