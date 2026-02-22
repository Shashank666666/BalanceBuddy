import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Alert, ActivityIndicator } from 'react-native';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
    useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK, SHARED_COLORS } from '../constants/theme';



const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = isDark ? DARK : LIGHT;

    const { login, signup } = useAuth();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);



    const handleSignIn = async () => {
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        if (!trimmedEmail || !trimmedPassword) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            await login(trimmedEmail, trimmedPassword);
            navigation.replace('MainTabs');
        } catch (error) {
            let message = 'Please check your email and password.';
            if (error.code === 'auth/invalid-credentials') {
                message = 'Invalid email or password. Have you signed up yet?';
            }
            Alert.alert('Login Failed', message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async () => {
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        if (!trimmedEmail || !trimmedPassword) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        if (trimmedPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await signup(trimmedEmail, trimmedPassword);
            navigation.replace('MainTabs');
        } catch (error) {
            let message = error.message;
            if (error.code === 'auth/email-already-in-use') {
                message = 'This email is already registered. Try signing in!';
            }
            Alert.alert('Signup Failed', message);
        } finally {
            setLoading(false);
        }
    };



    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Background Decoration */}
                <View style={[styles.bubble, { top: 300, right: -60, backgroundColor: COLORS.purpleBubble }]} />
                <View style={[styles.bubble, { top: 600, left: -80, width: 280, height: 280, backgroundColor: COLORS.cyanBubble }]} />

                {/* Header Banner */}
                <View style={styles.headerWrapper}>
                    <LinearGradient
                        colors={['#0F172A', '#1E293B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.headerGradient}
                    >
                        {/* Decorative circles */}
                        <View style={styles.circleTopRight} />
                        <View style={styles.circleBottomRight} />

                        <View style={styles.headerContent}>
                            {/* Wallet icon */}
                            <View style={[styles.planeContainer, { backgroundColor: '#38BDF8' }]}>
                                <MaterialCommunityIcons name="wallet-travel" size={40} color="#fff" />
                            </View>
                            <Text style={styles.welcomeTitle}>Welcome back!</Text>
                            <Text style={styles.welcomeSubtitle}>Sign in to your BalanceBuddy account</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Form Section */}
                <View style={[styles.formContainer, { backgroundColor: theme.background }]}>
                    {/* Email Field */}
                    <View style={styles.fieldGroup}>
                        <Text style={[styles.label, { color: theme.textPrimary }]}>Email</Text>
                        <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <Ionicons
                                name="mail-outline"
                                size={18}
                                color={theme.textSecondary}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                style={[styles.input, { color: theme.textPrimary }]}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>
                    </View>

                    {/* Password Field */}
                    <View style={styles.fieldGroup}>
                        <Text style={[styles.label, { color: theme.textPrimary }]}>Password</Text>
                        <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <Ionicons
                                name="lock-closed-outline"
                                size={18}
                                color={theme.textSecondary}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                style={[styles.input, { color: theme.textPrimary }]}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                placeholderTextColor={theme.textMuted}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeBtn}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={18}
                                    color={theme.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Forgot Password */}
                    <TouchableOpacity style={styles.forgotWrapper}>
                        <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>

                    {/* Sign In Button */}
                    <TouchableOpacity onPress={handleSignIn} activeOpacity={0.85} disabled={loading}>
                        <LinearGradient
                            colors={['#0EA5E9', '#2DD4BF']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.signInBtn}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.signInBtnText}>Sign In</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>



                    {/* Sign Up Link */}
                    <View style={styles.signupRow}>
                        <Text style={[styles.signupText, { color: theme.textSecondary }]}>Don't have an account? </Text>
                        <TouchableOpacity onPress={handleSignUp}>
                            <Text style={styles.signupLink}>Sign up free</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },

    // Header
    headerWrapper: {
        overflow: 'hidden',
        borderBottomLeftRadius: RADIUS.xl,
        borderBottomRightRadius: RADIUS.xl,
    },
    headerGradient: {
        paddingTop: 60,
        paddingBottom: 40,
        paddingHorizontal: SPACING.lg,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 220,
    },
    circleTopRight: {
        position: 'absolute',
        top: -30,
        right: -30,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(167, 139, 250, 0.3)',
    },
    circleBottomRight: {
        position: 'absolute',
        bottom: -40,
        right: 40,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    headerContent: {
        zIndex: 1,
    },
    planeContainer: {
        marginBottom: SPACING.sm,
    },
    planeEmoji: {
        fontSize: 38,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginTop: SPACING.xs,
        marginBottom: SPACING.xs,
    },
    welcomeSubtitle: {
        fontSize: FONTS.sizes.md,
        color: 'rgba(255,255,255,0.8)',
    },

    // Form
    formContainer: {
        padding: SPACING.lg,
        paddingTop: SPACING.xl,
    },
    fieldGroup: {
        marginBottom: SPACING.base,
    },
    label: {
        color: COLORS.textPrimary,
        fontSize: FONTS.sizes.md,
        fontWeight: '600',
        marginBottom: SPACING.sm,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        height: 52,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    inputIcon: {
        marginRight: SPACING.sm,
    },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: FONTS.sizes.md,
        fontWeight: '400',
    },
    eyeBtn: {
        padding: SPACING.xs,
    },
    forgotWrapper: {
        alignItems: 'flex-end',
        marginBottom: SPACING.lg,
        marginTop: SPACING.xs,
    },
    forgotText: {
        color: COLORS.violet,
        fontSize: FONTS.sizes.md,
        fontWeight: '500',
    },

    // Sign In Btn
    signInBtn: {
        height: 54,
        borderRadius: RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xl,
        shadowColor: COLORS.purpleMid,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },
    signInBtnText: {
        color: COLORS.textPrimary,
        fontSize: FONTS.sizes.base,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    // Divider
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.sm,
        marginHorizontal: SPACING.sm,
    },

    // Social
    socialRow: {
        marginBottom: SPACING.xl,
    },
    socialBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderRadius: RADIUS.md,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        gap: SPACING.sm,
    },
    socialIcon: {
        fontSize: 18,
    },
    socialText: {
        fontSize: FONTS.sizes.md,
        fontWeight: '600',
    },

    // Sign Up
    signupRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    signupText: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.md,
    },
    signupLink: {
        color: '#0EA5E9',
        fontSize: FONTS.sizes.md,
        fontWeight: '700',
    },
});
