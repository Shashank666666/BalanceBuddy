import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, TextInput, Dimensions, ActivityIndicator, Alert, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, DARK } from '../constants/theme';
import { CURRENCIES as ALL_CURRENCIES } from '../constants/currencies';

const { width } = Dimensions.get('window');

const CURRENCIES = ALL_CURRENCIES;

export default function CurrencyConverterScreen({ navigation, route }) {
    const [amount, setAmount] = useState('1');
    const [fromCurr, setFromCurr] = useState(route.params?.fromCurr || 'USD');
    const [toCurr, setToCurr] = useState(route.params?.toCurr || 'EUR');
    const [rates, setRates] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('from'); // 'from' or 'to'
    const [searchQuery, setSearchQuery] = useState('');

    // Ensure we have flags for passed currencies if they aren't in CURRENCIES
    useEffect(() => {
        if (route.params?.fromCurr) setFromCurr(route.params.fromCurr);
        if (route.params?.toCurr) setToCurr(route.params.toCurr);
    }, [route.params]);

    useEffect(() => {
        fetchRates();
    }, [fromCurr]);

    const fetchRates = async () => {
        setLoading(true);
        try {
            const response = await fetch(`https://api.frankfurter.app/latest?from=${fromCurr}`);

            if (!response.ok) {
                if (response.status === 404 || response.status === 422) {
                    throw new Error(`${fromCurr} is not supported by this provider yet. Frankfurt supports ~30 major currencies.`);
                }
                throw new Error('Failed to fetch rates');
            }

            const data = await response.json();

            if (data.rates) {
                // Frankfurt doesn't include the base currency in rates, add it for convenience
                setRates({ ...data.rates, [fromCurr]: 1.0 });
                setLastUpdated(data.date);
            } else {
                throw new Error('Invalid data format received');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Currency Provider Error', error.message || 'Network error while fetching rates');
        } finally {
            setLoading(false);
        }
    };

    const convertedAmount = rates && rates[toCurr]
        ? (parseFloat(amount || 0) * rates[toCurr]).toFixed(2)
        : '0.00';

    const getFlag = (code) => CURRENCIES.find(c => c.code === code)?.flag || '🏳️';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent />

            {/* Header */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={styles.header}
            >
                <View style={[styles.headerCircle, { top: -20, right: -20, width: 140, height: 140, backgroundColor: 'rgba(56, 189, 248, 0.1)' }]} />
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Currency Converter</Text>
                        <Text style={styles.headerSubtitle}>Live Exchange Rates</Text>
                    </View>
                    <TouchableOpacity onPress={fetchRates} style={styles.refreshBtn}>
                        <Ionicons name="refresh" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.glassCard}>
                    {/* From Section */}
                    <Text style={styles.label}>AMOUNT TO CONVERT</Text>
                    <View style={styles.amountWrapper}>
                        <TextInput
                            style={styles.amountInput}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor="rgba(255,255,255,0.2)"
                        />
                        <TouchableOpacity
                            style={styles.currencySelector}
                            onPress={() => { setModalType('from'); setShowModal(true); }}
                        >
                            <Text style={styles.flag}>{getFlag(fromCurr)}</Text>
                            <Text style={styles.currCode}>{fromCurr}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <TouchableOpacity style={styles.swapBtn} onPress={() => {
                            const temp = fromCurr;
                            setFromCurr(toCurr);
                            setToCurr(temp);
                        }}>
                            <Ionicons name="swap-vertical" size={20} color="#0EA5E9" />
                        </TouchableOpacity>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* To Section */}
                    <Text style={styles.label}>CONVERTED AMOUNT</Text>
                    <View style={styles.amountWrapper}>
                        <View style={styles.resultContainer}>
                            <Text style={styles.resultText}>{convertedAmount}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.currencySelector}
                            onPress={() => { setModalType('to'); setShowModal(true); }}
                        >
                            <Text style={styles.flag}>{getFlag(toCurr)}</Text>
                            <Text style={styles.currCode}>{toCurr}</Text>
                        </TouchableOpacity>
                    </View>

                    {loading && <ActivityIndicator color="#0EA5E9" style={{ marginTop: 20 }} />}

                    {!loading && rates && (
                        <View style={styles.comparisonSection}>
                            <View style={styles.infoRow}>
                                <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />
                                <Text style={styles.infoText}>
                                    1 {fromCurr} = {rates[toCurr]?.toFixed(4)} {toCurr}
                                </Text>
                            </View>

                            <View style={styles.comparisonHeader}>
                                <View style={styles.comparisonLine} />
                                <Text style={styles.comparisonTitle}>VALUATION COMPARISON</Text>
                                <View style={styles.comparisonLine} />
                            </View>

                            <View style={styles.comparisonGrid}>
                                {['USD', 'EUR', 'GBP', 'JPY'].filter(c => c !== fromCurr && c !== toCurr).map(curr => (
                                    <View key={curr} style={styles.comparisonItem}>
                                        <Text style={styles.comparisonLabel}>{curr}</Text>
                                        <Text style={styles.comparisonValue}>
                                            {(parseFloat(amount || 0) * (rates[curr] || 0)).toFixed(2)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Popular Rates Grid */}
                <Text style={styles.sectionTitle}>POPULAR CURRENCIES</Text>
                <View style={styles.grid}>
                    {CURRENCIES.filter(c => c.code !== fromCurr).map((item) => (
                        <TouchableOpacity
                            key={item.code}
                            style={[styles.gridItem, toCurr === item.code && styles.gridItemActive]}
                            onPress={() => setToCurr(item.code)}
                        >
                            <Text style={styles.gridFlag}>{item.flag}</Text>
                            <Text style={styles.gridCode}>{item.code}</Text>
                            <Text style={styles.gridRate}>
                                {rates ? (parseFloat(amount || 0) * (rates[item.code] || 0)).toFixed(2) : '--'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {lastUpdated && (
                    <Text style={styles.updatedAt}>Last updated: {lastUpdated}</Text>
                )}
            </ScrollView>

            {/* Currency Selection Modal */}
            <Modal visible={showModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select {modalType === 'from' ? 'Source' : 'Target'} Currency</Text>
                            <TouchableOpacity onPress={() => { setShowModal(false); setSearchQuery(''); }}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search currency name or code..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        <ScrollView style={{ maxHeight: 500 }}>
                            {CURRENCIES.filter(c =>
                                c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                c.name.toLowerCase().includes(searchQuery.toLowerCase())
                            ).map(item => (
                                <TouchableOpacity
                                    key={item.code}
                                    style={[
                                        styles.modalItem,
                                        (modalType === 'from' ? fromCurr : toCurr) === item.code && styles.modalItemActive
                                    ]}
                                    onPress={() => {
                                        if (modalType === 'from') setFromCurr(item.code);
                                        else setToCurr(item.code);
                                        setShowModal(false);
                                        setSearchQuery('');
                                    }}
                                >
                                    <Text style={styles.modalFlag}>{item.flag}</Text>
                                    <View>
                                        <Text style={styles.modalCode}>{item.code}</Text>
                                        <Text style={styles.modalName}>{item.name}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 25, position: 'relative', overflow: 'hidden' },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 },
    headerCircle: { position: 'absolute', borderRadius: 999 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
    refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
    headerSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginTop: 2 },

    content: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },

    glassCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 30,
    },
    label: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
    amountWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        height: 60,
        paddingHorizontal: 16,
    },
    amountInput: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
    resultContainer: { flex: 1, justifyContent: 'center' },
    resultText: { color: '#0EA5E9', fontSize: 20, fontWeight: '800' },
    currencySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.2)',
    },
    flag: { fontSize: 18, marginRight: 8 },
    currCode: { color: '#fff', fontSize: 14, fontWeight: '800' },

    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
    swapBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(14, 165, 233, 0.08)',
        justifyContent: 'center', alignItems: 'center',
        marginHorizontal: 15,
        borderWidth: 1,
        borderColor: 'rgba(14, 165, 233, 0.2)',
    },

    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 6, justifyContent: 'center' },
    infoText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' },

    sectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem: {
        width: (width - 52) / 3,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    gridItemActive: { borderColor: '#0EA5E9', backgroundColor: 'rgba(14, 165, 233, 0.05)' },
    gridFlag: { fontSize: 24, marginBottom: 10 },
    gridCode: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', marginBottom: 4 },
    gridRate: { color: '#fff', fontSize: 15, fontWeight: '800' },

    updatedAt: { color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center', marginTop: 30, fontStyle: 'italic' },

    // Comparison Styles
    comparisonSection: {
        marginTop: 20,
    },
    comparisonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 15,
        gap: 10,
    },
    comparisonLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    comparisonTitle: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1,
    },
    comparisonGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    comparisonItem: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 10,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    comparisonLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 4,
    },
    comparisonValue: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1E293B',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        paddingBottom: 40,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 20,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        marginLeft: 10,
        fontSize: 15,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    modalItemActive: {
        backgroundColor: 'rgba(14, 165, 233, 0.15)',
    },
    modalFlag: {
        fontSize: 24,
        marginRight: 16,
    },
    modalCode: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    modalName: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
    },
});
