import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, TextInput, Dimensions, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, DARK } from '../constants/theme';

const { width } = Dimensions.get('window');

const CURRENCIES = [
    { code: 'USD', flag: '🇺🇸', name: 'US Dollar' },
    { code: 'EUR', flag: '🇪🇺', name: 'Euro' },
    { code: 'GBP', flag: '🇬🇧', name: 'British Pound' },
    { code: 'INR', flag: '🇮🇳', name: 'Indian Rupee' },
    { code: 'JPY', flag: '🇯🇵', name: 'Japanese Yen' },
    { code: 'AUD', flag: '🇦🇺', name: 'Australian Dollar' },
    { code: 'SGD', flag: '🇸🇬', name: 'Singapore Dollar' },
    { code: 'THB', flag: '🇹🇭', name: 'Thai Baht' },
];

export default function CurrencyConverterScreen({ navigation }) {
    const [amount, setAmount] = useState('1');
    const [fromCurr, setFromCurr] = useState('USD');
    const [toCurr, setToCurr] = useState('EUR');
    const [rates, setRates] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        fetchRates();
    }, [fromCurr]);

    const fetchRates = async () => {
        setLoading(true);
        const API_KEY = '0c65db1ed39247c720952a990c228cc4';
        try {
            // Using exchangerate.host with the provided API key
            const response = await fetch(`http://api.exchangerate.host/live?access_key=${API_KEY}&source=${fromCurr}`);
            const data = await response.json();

            if (data.success) {
                // exchangerate.host live output is { quotes: { SOURCECURR: RATE } }
                // We need to transform quotes e.g. "USDGBP": 0.8 to { "GBP": 0.8 }
                const transformedRates = {};
                Object.keys(data.quotes).forEach(key => {
                    const currencyCode = key.replace(fromCurr, '');
                    transformedRates[currencyCode] = data.quotes[key];
                });
                setRates(transformedRates);
                setLastUpdated(new Date(data.timestamp * 1000).toLocaleString());
            } else {
                Alert.alert('Error', data.error?.info || 'Failed to fetch exchange rates');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Network error while fetching rates');
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
                            onPress={() => {/* In a real app, show a picker */ }}
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
                            onPress={() => {/* In a real app, show a picker */ }}
                        >
                            <Text style={styles.flag}>{getFlag(toCurr)}</Text>
                            <Text style={styles.currCode}>{toCurr}</Text>
                        </TouchableOpacity>
                    </View>

                    {loading && <ActivityIndicator color="#0EA5E9" style={{ marginTop: 20 }} />}

                    {!loading && rates && (
                        <View style={styles.infoRow}>
                            <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />
                            <Text style={styles.infoText}>
                                1 {fromCurr} = {rates[toCurr]?.toFixed(4)} {toCurr}
                            </Text>
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
                                {rates ? rates[item.code]?.toFixed(2) : '--'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {lastUpdated && (
                    <Text style={styles.updatedAt}>Last updated: {lastUpdated}</Text>
                )}
            </ScrollView>
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
});
