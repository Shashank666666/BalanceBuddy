import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    Animated,
    useColorScheme,
    SafeAreaView,
    ActivityIndicator,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, DARK, LIGHT, SHARED_COLORS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

// Define light/dark colors here if theme.js isn't fully updated yet
const THEME_COLORS = {
    light: {
        background: '#F8FAFC',
        textPrimary: '#0F172A',
        textSecondary: '#475569',
        cardBg: '#FFFFFF',
        accent: '#0EA5E9',
    },
    dark: {
        background: '#020617',
        textPrimary: '#F1F5F9',
        textSecondary: '#94A3B8',
        cardBg: '#0F172A',
        accent: '#38BDF8',
    }
};

const SLIDES = [
    {
        id: 'splash',
        type: 'splash',
        title: 'BalanceBuddy',
        subtitle: 'Split smarter. Travel together.',
        pills: ['Multi-currency', 'Fair', 'Zero'],
        icon: 'airplane',
        accent: '#0EA5E9',
    },
    {
        id: '1',
        type: 'content',
        title: 'Travel Together,\nPay Separately',
        description: 'Log expenses in any currency — euros, dollars, yen — as you spend. BalanceBuddy converts everything automatically with live exchange rates.',
        icon: '🌍',
        gradient: ['#0EA5E9', '#2DD4BF'],
        pills: ['Multi-currency', 'Auto-convert', 'Live'],
        accent: '#0EA5E9',
    },
    {
        id: '2',
        type: 'content',
        title: 'Fair Splits,\nZero Guesswork',
        description: 'Split only with people who were there. Someone skipped dinner? No problem. Customize every expense for perfect fairness.',
        icon: '⚖️',
        gradient: ['#6366F1', '#A855F7'],
        pills: ['Custom', 'Per-activity', 'Transparent'],
        accent: '#6366F1',
    },
];

export default function OnboardingScreen({ navigation }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = THEME_COLORS[colorScheme] || THEME_COLORS.dark;

    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef(null);

    const viewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const scrollTo = () => {
        if (currentIndex < SLIDES.length - 1) {
            slidesRef.current.scrollToIndex({ index: currentIndex + 1 });
        } else {
            navigation.replace('Login');
        }
    };

    const handleSkip = () => {
        navigation.replace('Login');
    };

    useEffect(() => {
        if (currentIndex === 0) {
            const timer = setTimeout(() => {
                scrollTo();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [currentIndex]);

    const renderSplash = (item) => (
        <LinearGradient
            colors={['#0F172A', '#1E293B', '#0F172A']}
            style={styles.splashContainer}
        >
            <View style={styles.splashCirclesContainer}>
                <View style={[styles.splashCircle, { top: -100, left: -100, width: 400, height: 400, opacity: 0.05, backgroundColor: '#38BDF8' }]} />
                <View style={[styles.splashCircle, { bottom: -150, right: -100, width: 500, height: 500, opacity: 0.1, backgroundColor: '#2DD4BF' }]} />
            </View>

            <View style={styles.splashContent}>
                <View style={styles.logoOuterRing}>
                    <LinearGradient
                        colors={['#38BDF8', '#2DD4BF']}
                        style={styles.logoInner}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Animated.Image
                            source={require('../../assets/icon.png')}
                            style={{ width: 80, height: 80, borderRadius: 20 }}
                            resizeMode="contain"
                        />
                    </LinearGradient>
                </View>

                <Animated.View style={styles.titleContainer}>
                    <Text style={styles.splashTitle}>Balance<Text style={{ color: '#38BDF8' }}>Buddy</Text></Text>
                    <View style={styles.subtitleWrapper}>
                        <View style={styles.separator} />
                        <Text style={styles.splashSubtitle}>FINANCE YOUR ADVENTURE</Text>
                        <View style={styles.separator} />
                    </View>
                </Animated.View>

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
                    <Text style={styles.loadingText}>Initializing your journey...</Text>
                </View>
            </View>

            {/* Decorative money icons with varied sizes and opacities */}
            <View style={[styles.floatingIcon, { top: '15%', left: '12%' }]}>
                <Ionicons name="airplane-outline" size={24} color="#38BDF8" opacity={0.4} />
            </View>
            <View style={[styles.floatingIcon, { top: '25%', right: '15%' }]}>
                <MaterialCommunityIcons name="currency-usd" size={28} color="#2DD4BF" opacity={0.3} />
            </View>
            <View style={[styles.floatingIcon, { bottom: '25%', left: '20%' }]}>
                <MaterialCommunityIcons name="currency-eur" size={20} color="#38BDF8" opacity={0.3} />
            </View>
            <View style={[styles.floatingIcon, { bottom: '15%', right: '10%' }]}>
                <Ionicons name="card-outline" size={26} color="#2DD4BF" opacity={0.4} />
            </View>
        </LinearGradient>
    );

    const renderContent = (item) => (
        <View style={[styles.contentSlide, { backgroundColor: theme.background }]}>
            {/* Background Decoration */}
            <View style={[styles.bubble, { top: 150, right: -60, backgroundColor: COLORS.purpleBubble }]} />
            <View style={[styles.bubble, { top: 500, left: -80, width: 280, height: 280, backgroundColor: COLORS.cyanBubble }]} />

            <View style={styles.slideHeader}>
                <View style={styles.paginationDotsHeader}>
                    {SLIDES.slice(1).map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.headerDot,
                                {
                                    backgroundColor: currentIndex === i + 1 ? item.accent : (isDark ? 'rgba(255,255,255,0.2)' : '#E2E8F0'),
                                    width: currentIndex === i + 1 ? 24 : 8
                                }
                            ]}
                        />
                    ))}
                </View>
                <TouchableOpacity onPress={handleSkip}>
                    <Text style={[styles.skipText, { color: theme.textSecondary }]}>Skip</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.imageCardContainer}>
                <LinearGradient
                    colors={item.gradient || ['#8B5CF6', '#7C3AED']}
                    style={styles.imageCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.imageCardCircle} />
                    {item.icon.length > 2 ? (
                        <MaterialCommunityIcons name={item.icon} size={100} color="#fff" />
                    ) : (
                        <Text style={{ fontSize: 100 }}>{item.icon}</Text>
                    )}
                    <View style={styles.pillRowCard}>
                        {item.pills.map((pill, idx) => (
                            <View key={idx} style={styles.pillCard}>
                                <Text style={styles.pillTextCard}>{pill}</Text>
                            </View>
                        ))}
                    </View>
                </LinearGradient>
            </View>

            <View style={styles.textContainer}>
                <Text style={[styles.contentTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.contentDescription, { color: theme.textSecondary }]}>{item.description}</Text>
            </View>

            <View style={styles.bottomActions}>
                <TouchableOpacity style={styles.continueBtn} onPress={scrollTo}>
                    <LinearGradient
                        colors={item.gradient ? [item.gradient[0], item.gradient[1]] : ['#7C3AED', '#9333EA']}
                        style={styles.continueGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.continueText}>
                            {currentIndex === SLIDES.length - 1 ? 'Get Started 🚀' : 'Continue'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderSlide = ({ item }) => {
        if (item.type === 'splash') return renderSplash(item);
        return renderContent(item);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" transparent translucent />

            <FlatList
                data={SLIDES}
                renderItem={renderSlide}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                bounces={false}
                keyExtractor={(item) => item.id}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                    useNativeDriver: false,
                })}
                onViewableItemsChanged={viewableItemsChanged}
                viewConfig={viewConfig}
                ref={slidesRef}
            />

            {currentIndex === 0 && (
                <View style={styles.splashPagination}>
                    <View style={[styles.dotSplash, { opacity: 1, width: 12, height: 12, borderRadius: 6 }]} />
                    <View style={[styles.dotSplash, { opacity: 0.3 }]} />
                    <View style={[styles.dotSplash, { opacity: 0.3 }]} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    bubble: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        zIndex: 0,
        opacity: 0.15,
    },
    // Splash
    splashContainer: {
        width,
        height,
        justifyContent: 'center',
        alignItems: 'center',
    },
    splashCirclesContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    splashCircle: {
        position: 'absolute',
        borderRadius: 999,
    },
    splashContent: {
        alignItems: 'center',
        zIndex: 1,
    },
    logoOuterRing: {
        width: 140,
        height: 140,
        borderRadius: 45,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 40,
    },
    logoInner: {
        width: 110,
        height: 110,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#818CF8',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    splashTitle: {
        color: '#fff',
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: -1.5,
    },
    subtitleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 10,
    },
    separator: {
        height: 1,
        width: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    splashSubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 2,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    loadingText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        fontWeight: '600',
    },
    floatingIcon: {
        position: 'absolute',
        padding: 10,
    },
    splashPagination: {
        position: 'absolute',
        bottom: 50,
        flexDirection: 'row',
        alignSelf: 'center',
        alignItems: 'center',
        gap: 8,
    },
    dotSplash: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
    },

    // Content
    contentSlide: {
        width,
        height,
        paddingTop: 60,
    },
    slideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
        marginBottom: 30,
    },
    paginationDotsHeader: {
        flexDirection: 'row',
        gap: 6,
    },
    headerDot: {
        height: 8,
        borderRadius: 4,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '700',
    },
    imageCardContainer: {
        paddingHorizontal: 20,
        marginBottom: 40,
    },
    imageCard: {
        width: '100%',
        height: height * 0.35,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    imageCardCircle: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    pillRowCard: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 30,
    },
    pillCard: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 15,
    },
    pillTextCard: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    textContainer: {
        paddingHorizontal: 40,
        alignItems: 'center',
    },
    contentTitle: {
        fontSize: 32,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 40,
        marginBottom: 20,
    },
    contentDescription: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    bottomActions: {
        position: 'absolute',
        bottom: 60,
        width: '100%',
        paddingHorizontal: 30,
        alignItems: 'center',
    },
    continueBtn: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    continueGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    signInLink: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    signInLinkBold: {
        color: '#7C3AED',
        fontWeight: '700',
    },
});
