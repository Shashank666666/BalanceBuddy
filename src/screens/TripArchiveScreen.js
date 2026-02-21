import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (raw) => {
    if (!raw) return null;
    // handles Firestore Timestamp and plain string
    if (typeof raw === 'string') {
        const d = new Date(raw);
        if (!isNaN(d)) return { day: d.getDate(), month: MONTH_NAMES[d.getMonth()], year: d.getFullYear() };
    }
    if (raw?.seconds) {
        const d = new Date(raw.seconds * 1000);
        return { day: d.getDate(), month: MONTH_NAMES[d.getMonth()], year: d.getFullYear() };
    }
    return null;
};

const formatDateRange = (start, end) => {
    const s = formatDate(start);
    const e = formatDate(end);
    if (!s && !e) return 'Dates not set';
    if (!s) return `Until ${e.day} ${e.month} ${e.year}`;
    if (!e) return `From ${s.day} ${s.month} ${s.year}`;
    if (s.year === e.year && s.month === e.month)
        return `${s.day} – ${e.day} ${s.month} ${s.year}`;
    if (s.year === e.year)
        return `${s.day} ${s.month} – ${e.day} ${e.month} ${s.year}`;
    return `${s.day} ${s.month} ${s.year} – ${e.day} ${e.month} ${e.year}`;
};

const STATUS_COLORS = {
    Completed: { line: '#10B981', badge: 'rgba(16,185,129,0.15)', badgeText: '#10B981', badgeBorder: 'rgba(16,185,129,0.25)' },
    Cancelled: { line: '#EF4444', badge: 'rgba(239,68,68,0.12)', badgeText: '#EF4444', badgeBorder: 'rgba(239,68,68,0.2)' },
    default: { line: '#6366F1', badge: 'rgba(99,102,241,0.12)', badgeText: '#A78BFA', badgeBorder: 'rgba(99,102,241,0.2)' },
};

export default function TripArchiveScreen({ navigation }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DARK : LIGHT;
    const { user } = useAuth();

    const [archivedTrips, setArchivedTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All'); // All | Completed | Cancelled

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'trips'),
            where('creatorId', '==', user.uid),
        );
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Archive = Completed or Cancelled
            const archived = all
                .filter(t => t.status === 'Completed' || t.status === 'Cancelled')
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setArchivedTrips(archived);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const displayed = filter === 'All'
        ? archivedTrips
        : archivedTrips.filter(t => t.status === filter);

    // Group by year for timeline sections
    const grouped = displayed.reduce((acc, trip) => {
        const s = formatDate(trip.startDate || trip.createdAt);
        const year = s ? String(s.year) : 'Unknown Year';
        if (!acc[year]) acc[year] = [];
        acc[year].push(trip);
        return acc;
    }, {});

    const years = Object.keys(grouped).sort((a, b) => b - a);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" translucent />

            {/* Header */}
            <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
                <View style={styles.headerNav}>
                    <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Trip Archive</Text>
                        <Text style={styles.headerSub}>{archivedTrips.length} journeys recorded</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Filter chips */}
                <View style={styles.filterRow}>
                    {['All', 'Completed', 'Cancelled'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, filter === f && styles.filterChipActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="archive-clock" size={56} color="rgba(255,255,255,0.1)" />
                        <Text style={[styles.emptyTitle, { color: 'rgba(255,255,255,0.3)' }]}>Loading...</Text>
                    </View>
                ) : displayed.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="archive-off-outline" size={64} color="rgba(255,255,255,0.08)" />
                        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No archived trips</Text>
                        <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                            {filter === 'All'
                                ? 'Completed and cancelled trips will appear here'
                                : `No ${filter.toLowerCase()} trips found`}
                        </Text>
                    </View>
                ) : (
                    years.map((year) => (
                        <View key={year}>
                            {/* Year label */}
                            <View style={styles.yearRow}>
                                <View style={styles.yearLine} />
                                <Text style={styles.yearLabel}>{year}</Text>
                                <View style={styles.yearLine} />
                            </View>

                            {/* Timeline cards for this year */}
                            {grouped[year].map((trip, idx) => {
                                const statusStyle = STATUS_COLORS[trip.status] || STATUS_COLORS.default;
                                const isLast = idx === grouped[year].length - 1;
                                const startFmt = formatDate(trip.startDate || trip.createdAt);
                                const endFmt = formatDate(trip.endDate);

                                return (
                                    <View key={trip.id} style={styles.timelineItem}>
                                        {/* Left: dot + vertical line */}
                                        <View style={styles.timelineLeft}>
                                            <View style={[styles.timelineDot, { backgroundColor: statusStyle.line }]} />
                                            {!isLast && <View style={[styles.timelineConnector, { backgroundColor: statusStyle.line + '40' }]} />}
                                        </View>

                                        {/* Right: date + card */}
                                        <View style={styles.timelineRight}>
                                            {/* Date stamp */}
                                            {startFmt && (
                                                <View style={styles.dateStamp}>
                                                    <Text style={styles.dateDay}>{startFmt.day}</Text>
                                                    <Text style={styles.dateMonth}>{startFmt.month}</Text>
                                                </View>
                                            )}

                                            {/* Card */}
                                            <View style={styles.tripCard}>
                                                <View style={styles.tripCardHeader}>
                                                    {/* Icon + Name */}
                                                    <View style={styles.tripIconWrap}>
                                                        <Text style={{ fontSize: 24 }}>{trip.icon || '✈️'}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.tripName}>{trip.name}</Text>
                                                        <View style={styles.destinationRow}>
                                                            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.4)" />
                                                            <Text style={styles.tripDestination}>
                                                                {trip.destination || 'Destination not set'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    {/* Status badge */}
                                                    <View style={[styles.statusBadge, {
                                                        backgroundColor: statusStyle.badge,
                                                        borderColor: statusStyle.badgeBorder
                                                    }]}>
                                                        <Text style={[styles.statusText, { color: statusStyle.badgeText }]}>
                                                            {trip.status}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <View style={styles.tripCardDivider} />

                                                {/* Date range + travellers */}
                                                <View style={styles.tripMeta}>
                                                    <View style={styles.metaItem}>
                                                        <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.35)" />
                                                        <Text style={styles.metaText}>
                                                            {formatDateRange(trip.startDate, trip.endDate)}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.metaItem}>
                                                        <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.35)" />
                                                        <Text style={styles.metaText}>
                                                            {trip.travellers?.length || 1} traveller{(trip.travellers?.length || 1) !== 1 ? 's' : ''}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Destination country label if distinct */}
                                                {trip.destination && (
                                                    <View style={styles.placeTag}>
                                                        <Text style={styles.placeTagText}>📍 {trip.destination}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ))
                )}
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 52, paddingHorizontal: SPACING.base, paddingBottom: 20 },
    headerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
    headerSub: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 2 },

    filterRow: { flexDirection: 'row', gap: 8 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    filterChipActive: { backgroundColor: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.4)' },
    filterChipText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700' },
    filterChipTextActive: { color: '#A78BFA' },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: SPACING.base, paddingTop: 20 },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 80, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptySub: { fontSize: 13, textAlign: 'center' },

    // Year separator
    yearRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, marginTop: 8 },
    yearLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
    yearLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },

    // Timeline structure
    timelineItem: { flexDirection: 'row', marginBottom: 20 },
    timelineLeft: { width: 30, alignItems: 'center' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 20, borderWidth: 2, borderColor: '#0F172A' },
    timelineConnector: { width: 2, flex: 1, marginTop: 6 },

    timelineRight: { flex: 1, marginLeft: 12 },
    dateStamp: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 8 },
    dateDay: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 26 },
    dateMonth: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

    // Trip card
    tripCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderRadius: 18, padding: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    },
    tripCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    tripIconWrap: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center', alignItems: 'center',
    },
    tripName: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1 },
    destinationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    tripDestination: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600' },

    statusBadge: {
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
        borderWidth: 1,
    },
    statusText: { fontSize: 10, fontWeight: '800' },

    tripCardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 12 },

    tripMeta: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },

    placeTag: {
        marginTop: 10,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.04)',
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    placeTagText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
});
