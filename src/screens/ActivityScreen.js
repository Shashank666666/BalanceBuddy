import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, TextInput, ActivityIndicator,
    useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['All', '🏨 Hotel', '🍔 Food', '✈️ Transport', '🎭 Activity'];

export default function ActivityScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DARK : LIGHT;

    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [selectedTripId, setSelectedTripId] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const [expenses, setExpenses] = useState([]);
    const [filteredExpenses, setFilteredExpenses] = useState([]);

    // Update last viewed time when screen is mounted
    useEffect(() => {
        if (user?.uid) {
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, {
                lastCheckedActivities: serverTimestamp()
            }).catch(err => console.error('Error updating activity timestamp:', err));
        }
    }, [user?.uid]);

    // 1. Listen to trips
    useEffect(() => {
        if (!user) return;

        const qTrips = query(
            collection(db, 'trips'),
            where('travellerEmails', 'array-contains', user.email?.toLowerCase())
        );

        const unsubscribeTrips = onSnapshot(qTrips, (snap) => {
            const tripsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setTrips([{ id: 'all', name: 'All Trips', icon: '🌎' }, ...tripsList]);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching trips:', err);
            setLoading(false);
        });

        return () => unsubscribeTrips();
    }, [user]);

    // 2. Listen to expenses for those trips
    useEffect(() => {
        if (!user || trips.length === 0) return;

        const allUnsubs = [];
        const realTrips = trips.filter(t => t.id !== 'all');
        const destExpUnsubs = new Map(); // Track destination-level listeners

        realTrips.forEach(trip => {
            // Direct expenses
            const qExpDirect = query(collection(db, 'trips', trip.id, 'expenses'));
            allUnsubs.push(onSnapshot(qExpDirect, (expSnap) => {
                const tripExpenses = expSnap.docs.map(d => ({
                    id: d.id,
                    tripId: trip.id,
                    tripName: trip.name,
                    source: 'direct',
                    ...d.data()
                }));

                setExpenses(prev => {
                    const otherExpenses = prev.filter(e => e.tripId !== trip.id || e.source !== 'direct');
                    const combined = [...otherExpenses, ...tripExpenses];
                    // Final deduplication by ID just in case
                    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                    return unique.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                });
            }, (err) => console.error('Direct exp error:', err)));

            // Destinations and their expenses
            const qDest = collection(db, 'trips', trip.id, 'destinations');
            allUnsubs.push(onSnapshot(qDest, (destSnap) => {
                const currentDestIds = destSnap.docs.map(d => d.id);

                // Cleanup removed destinations
                destExpUnsubs.forEach((unsub, id) => {
                    if (!currentDestIds.includes(id)) {
                        unsub();
                        destExpUnsubs.delete(id);
                        setExpenses(prev => prev.filter(e => e.destinationId !== id));
                    }
                });

                destSnap.docs.forEach(destDoc => {
                    const destId = destDoc.id;
                    const destName = destDoc.data().name;

                    if (!destExpUnsubs.has(destId)) {
                        const unsub = onSnapshot(query(collection(db, 'trips', trip.id, 'destinations', destId, 'expenses')), (expSnap) => {
                            const destExpenses = expSnap.docs.map(d => ({
                                id: d.id,
                                tripId: trip.id,
                                tripName: trip.name,
                                destinationId: destId,
                                destinationName: destName,
                                ...d.data()
                            }));

                            setExpenses(prev => {
                                const otherExpenses = prev.filter(e => e.destinationId !== destId);
                                const combined = [...otherExpenses, ...destExpenses];
                                const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                                return unique.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                            });
                        }, (err) => console.error(`Dest exp error [${destId}]:`, err));
                        destExpUnsubs.set(destId, unsub);
                    }
                });
            }, (err) => console.error('Dest list error:', err)));
        });

        return () => {
            allUnsubs.forEach(u => u());
            destExpUnsubs.forEach(u => u());
        };
    }, [trips, user?.uid]);

    useEffect(() => {
        let results = expenses;

        if (selectedTripId !== 'all') {
            results = results.filter(e => e.tripId === selectedTripId);
        }

        if (selectedCategory !== 'All') {
            results = results.filter(e => e.category === selectedCategory);
        }

        if (search.trim()) {
            results = results.filter(e =>
                e.title.toLowerCase().includes(search.toLowerCase()) ||
                e.tripName.toLowerCase().includes(search.toLowerCase())
            );
        }

        setFilteredExpenses(results);
    }, [expenses, selectedTripId, selectedCategory, search]);

    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.circleTopRight} />
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerTitle}>Activity</Text>
                        <Text style={styles.headerSubtitle}>{filteredExpenses.length} expenses · {totalAmount.toFixed(2)} total</Text>
                    </View>
                    <TouchableOpacity style={styles.refreshBtn}>
                        <Ionicons name="refresh-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
                <View style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                    <Ionicons name="search-outline" size={18} color="#fff" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search expenses..."
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}>

                {/* Background Decoration */}
                <View style={[styles.bubble, { top: 100, left: -60, backgroundColor: COLORS.purpleBubble }]} />
                <View style={[styles.bubble, { top: 400, right: -80, width: 280, height: 280, backgroundColor: COLORS.cyanBubble }]} />

                {loading ? (
                    <ActivityIndicator color={COLORS.violet} style={{ marginTop: 20 }} />
                ) : (
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                            style={styles.chipRow} contentContainerStyle={styles.chipContent}>
                            {trips.map((trip) => (
                                <TouchableOpacity
                                    key={trip.id}
                                    onPress={() => setSelectedTripId(trip.id)}
                                    style={[
                                        styles.chip,
                                        { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderColor: 'rgba(255, 255, 255, 0.08)' },
                                        selectedTripId === trip.id && { backgroundColor: '#38BDF8', borderColor: '#38BDF8' }
                                    ]}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        { color: theme.textSecondary },
                                        selectedTripId === trip.id && { color: '#fff' }
                                    ]}>
                                        {trip.icon} {trip.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                            style={styles.categoryRow} contentContainerStyle={styles.categoryContent}>
                            {CATEGORIES.map((cat, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => setSelectedCategory(cat)}
                                    style={[
                                        styles.categoryTab,
                                        { backgroundColor: theme.cardBg, borderColor: theme.border },
                                        selectedCategory === cat && { backgroundColor: COLORS.violet, borderColor: COLORS.violet }
                                    ]}
                                >
                                    <Text style={[
                                        styles.categoryText,
                                        { color: theme.textSecondary },
                                        selectedCategory === cat && { color: '#fff' }
                                    ]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {filteredExpenses.length > 0 ? (
                            filteredExpenses.map((exp) => (
                                <View key={exp.id} style={styles.activityCard}>
                                    <View style={[styles.activityIcon, { backgroundColor: exp.color || COLORS.violet }]}>
                                        <Text style={{ fontSize: 18 }}>{exp.icon || '💸'}</Text>
                                    </View>
                                    <View style={styles.activityInfo}>
                                        <Text style={styles.activityTitle}>{exp.title}</Text>
                                        <Text style={styles.activityTrip}>
                                            {exp.tripName}{exp.destinationName ? ` · ${exp.destinationName}` : ''} · {exp.paidByNickname}
                                        </Text>
                                    </View>
                                    <View style={styles.activityAmountCol}>
                                        <Text style={styles.activityAmount}>{exp.amount.toFixed(2)}</Text>
                                        <Text style={styles.activityDate}>
                                            {exp.createdAt?.seconds ? new Date(exp.createdAt.seconds * 1000).toLocaleDateString() : 'Today'}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="receipt-outline" size={64} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No expenses found</Text>
                                <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>Expenses you add to trips will appear here</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
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
    header: { paddingTop: 60, paddingHorizontal: SPACING.base, paddingBottom: SPACING.base, overflow: 'hidden', position: 'relative', backgroundColor: COLORS.background },
    circleTopRight: { position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(56, 189, 248, 0.15)' },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.base, zIndex: 1 },
    headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
    headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
    refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, height: 44, gap: SPACING.sm, borderWidth: 1, zIndex: 1 },
    searchInput: { flex: 1, color: '#fff', fontSize: 15 },
    content: { flex: 1 },
    scrollContent: { padding: SPACING.sm, paddingBottom: 100 },
    chipRow: { marginBottom: SPACING.md },
    chipContent: { gap: SPACING.sm, paddingRight: SPACING.sm },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1 },
    chipText: { fontSize: 14, fontWeight: '600' },
    categoryRow: { marginBottom: SPACING.base },
    categoryContent: { gap: SPACING.sm, paddingRight: SPACING.sm },
    categoryTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1 },
    categoryText: { fontSize: 13, fontWeight: '500' },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 12,
    },
    activityIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    activityInfo: {
        flex: 1,
    },
    activityTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    activityTrip: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
        marginTop: 2,
    },
    activityAmountCol: {
        alignItems: 'flex-end',
    },
    activityAmount: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    activityDate: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 10,
        marginTop: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 20,
    },
    emptySubtitle: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});
