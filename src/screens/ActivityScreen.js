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
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'trips'),
            where('creatorId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const tripsData = [{ id: 'all', name: 'All Trips', icon: '🌎' }];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                tripsData.push({ id: doc.id, name: data.name, icon: data.icon });
            });
            setTrips(tripsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching trips for activity:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

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
                        <Text style={styles.headerSubtitle}>0 expenses · $0 total</Text>
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

                        <View style={styles.emptyContainer}>
                            <Ionicons name="receipt-outline" size={64} color={theme.textMuted} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No expenses found</Text>
                            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>Expenses you add to trips will appear here</Text>
                        </View>
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
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
    emptyText: { fontSize: 18, fontWeight: '700', marginTop: 20 },
    emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
