import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
    TextInput,
    Dimensions,
    useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, Alert } from 'react-native';

const { width } = Dimensions.get('window');

const FILTERS = ['All', 'Active', 'Planning'];

const Avatar = ({ letter, color, style }) => (
    <View style={[styles.avatar, { backgroundColor: color }, style]}>
        <Text style={styles.avatarText}>{letter}</Text>
    </View>
);

const TripCard = ({ trip, navigation }) => {
    const isActive = trip.status === 'Active';

    return (
        <TouchableOpacity
            style={styles.tripCard}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('TripDetail', { trip })}
        >
            <View style={styles.tripRow}>
                <View style={styles.tripIconWrapper}>
                    <LinearGradient
                        colors={['#0EA5E9', '#2DD4BF']}
                        style={styles.tripIcon}
                    >
                        <Text style={styles.tripIconEmoji}>{trip.icon || '✈️'}</Text>
                    </LinearGradient>
                </View>
                <View style={styles.tripInfo}>
                    <View style={styles.tripTitleRow}>
                        <Text style={styles.tripName}>{trip.name}</Text>
                        <View style={[
                            styles.statusBadge,
                            isActive ? styles.activeBadge : styles.planningBadge
                        ]}>
                            <Text style={[
                                styles.statusBadgeText,
                                isActive ? styles.activeText : styles.planningText
                            ]}>{trip.status}</Text>
                        </View>
                    </View>
                    <Text style={styles.tripLocation}>
                        {trip.destination || 'No location'}
                        {trip.destinationCount > 1 ? ` (+${trip.destinationCount - 1})` : ''}
                    </Text>
                    <View style={styles.tripMetaRow}>
                        <Ionicons name="people-outline" size={13} color={COLORS.textSecondary} />
                        <Text style={styles.tripMeta}> {trip.travellers?.length || 0} travellers</Text>
                        <Ionicons name="cash-outline" size={13} color={COLORS.textSecondary} style={{ marginLeft: 8 }} />
                        <Text style={styles.tripMeta}> {trip.baseCurrency} {trip.totalSpent || 0} spent</Text>
                    </View>

                    {trip.expenses && (
                        <Text style={styles.expensesText}>{trip.expenses}</Text>
                    )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </View>

            {/* Avatars row */}
            <View style={styles.avatarGroupRow}>
                <View style={styles.avatarGroup}>
                    {trip.travellers?.map((m, i) => (
                        <Avatar
                            key={i}
                            letter={m.letter}
                            color={m.color}
                            style={i > 0 ? styles.avatarOverlap : {}}
                        />
                    ))}
                </View>
                {trip.owedText && (
                    <Text style={styles.owedText}>{trip.owedText}</Text>
                )}
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarBg}>
                <LinearGradient
                    colors={['#0EA5E9', '#10B981']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBarFill, { width: `${Math.min((trip.totalSpent / (trip.budget || 1)) * 100, 100)}%` }]}
                />
            </View>

            {isActive && (
                <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={async () => {
                        Alert.alert('Complete Trip', 'Mark this trip as completed?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Complete',
                                onPress: async () => {
                                    try {
                                        await updateDoc(doc(db, 'trips', trip.id), { status: 'Completed' });
                                    } catch (e) {
                                        Alert.alert('Error', 'Failed to complete trip');
                                    }
                                }
                            }
                        ]);
                    }}
                >
                    <Text style={styles.completeBtnText}>Complete Trip</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

export default function TripsScreen({ navigation }) {
    const theme = DARK;

    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All');
    const [searchText, setSearchText] = useState('');

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
                const merged = [...trips1];
                trips2.forEach(t => {
                    if (!merged.find(m => m.id === t.id)) merged.push(t);
                });
                merged.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setTrips(merged);
                setLoading(false);
            });
        }, (error) => {
            console.error('Error fetching trips: ', error);
            setLoading(false);
        });

        return () => {
            unsub1();
            if (unsub2) unsub2();
        };
    }, [user]);

    const filteredTrips = trips.filter(t => {
        const matchFilter = activeFilter === 'All' || t.status === activeFilter;
        const matchSearch = t.name.toLowerCase().includes(searchText.toLowerCase()) ||
            (t.destination && t.destination.toLowerCase().includes(searchText.toLowerCase()));
        return matchFilter && matchSearch;
    });

    return (
        <View style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Header */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.header}
            >
                <View style={styles.circleTopRight} />

                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>My Trips</Text>
                        <Text style={styles.headerSubtitle}>{trips.length} journeys created</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                {/* Search Bar Integrated in Header */}
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.5)" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search your adventures..."
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Filter Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterRow}
                    contentContainerStyle={styles.filterContent}
                >
                    {FILTERS.map(f => (
                        <TouchableOpacity
                            key={f}
                            onPress={() => setActiveFilter(f)}
                            style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
                        >
                            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                                {f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {loading ? (
                    <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 60 }} />
                ) : filteredTrips.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons
                                name="map-outline"
                                size={40}
                                color="rgba(255,255,255,0.1)"
                            />
                        </View>
                        <Text style={styles.emptyText}>
                            {searchText ? "No adventures match search" :
                                activeFilter === 'Active' ? "No active trips" :
                                    activeFilter === 'Planning' ? "No trips planned" : "No trips found"}
                        </Text>
                        <Text style={styles.emptySubText}>
                            {searchText ? "Try different keywords or check your spelling" :
                                activeFilter === 'Active' ? "You don't have any ongoing journeys at the moment" :
                                    "Start planning your next journey by tapping the + icon above"}
                        </Text>
                    </View>
                ) : (
                    <>
                        {filteredTrips.filter(t => t.status !== 'Completed').map(trip => (
                            <TripCard key={trip.id} trip={trip} navigation={navigation} />
                        ))}

                        {activeFilter === 'All' && filteredTrips.filter(t => t.status === 'Completed').length > 0 && (
                            <>
                                <View style={styles.completedHeader}>
                                    <Ionicons name="checkmark-done" size={16} color="rgba(255,255,255,0.4)" />
                                    <Text style={styles.completedHeaderText}>COMPLETED JOURNEYS</Text>
                                </View>
                                {filteredTrips.filter(t => t.status === 'Completed').map(trip => (
                                    <TripCard key={trip.id} trip={trip} navigation={navigation} />
                                ))}
                            </>
                        )}
                    </>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },

    // Header
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 25,
        overflow: 'hidden',
        position: 'relative',
    },
    circleTopRight: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 25,
        zIndex: 1,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0EA5E9',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },

    // Search Bar
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        zIndex: 10,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },

    // Content
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },

    // Filters
    filterRow: {
        marginBottom: 20,
    },
    filterContent: {
        gap: 10,
        paddingRight: 20,
    },
    filterTab: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    filterTabActive: {
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        borderColor: '#0EA5E9',
    },
    filterText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 13,
        fontWeight: '700',
    },
    filterTextActive: {
        color: '#38BDF8',
    },

    // Trip Card
    tripCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    tripRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    tripIconWrapper: {
        marginRight: 16,
    },
    tripIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tripIconEmoji: {
        fontSize: 24,
    },
    tripInfo: {
        flex: 1,
    },
    tripTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    tripName: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '800',
    },
    statusBadge: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
    },
    activeBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    planningBadge: {
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        borderColor: 'rgba(167, 139, 250, 0.2)',
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    activeText: {
        color: '#10B981',
    },
    completedBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    completedText: {
        color: 'rgba(255, 255, 255, 0.4)',
    },
    planningText: {
        color: '#A78BFA',
    },
    tripLocation: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    tripMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tripMeta: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
        fontWeight: '600',
    },
    expensesText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 13,
        marginTop: 4,
    },

    // Avatars
    avatarGroupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    avatarGroup: {
        flexDirection: 'row',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#1E293B',
    },
    avatarText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    avatarOverlap: {
        marginLeft: -10,
    },
    owedText: {
        color: '#10B981',
        fontSize: 14,
        fontWeight: '700',
    },

    // Progress
    progressBarBg: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 20,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },

    // Complete Button
    completeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10B981',
        borderRadius: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#059669',
        marginTop: 8,
    },
    completeBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },

    // Completed section header
    completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 30, marginBottom: 15, paddingHorizontal: 4 },
    completedHeaderText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 20,
    },
});
