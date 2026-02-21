import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Alert,
    useColorScheme,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, LIGHT, DARK } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth as firebaseAuth } from '../config/firebase';

export default function EditProfileScreen({ navigation }) {
    const colorScheme = useColorScheme();
    const isDark = true; // Always dark theme now
    const theme = DARK;

    const { user } = useAuth();
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!displayName.trim()) {
            Alert.alert('Error', 'Display name cannot be empty');
            return;
        }

        setLoading(true);
        try {
            await updateProfile(firebaseAuth.currentUser, {
                displayName: displayName.trim(),
            });

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                displayName: displayName.trim(),
            });

            Alert.alert('Success', 'Profile updated successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Update Profile Error:', error);
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" translucent />

            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={[styles.bubble, { top: -50, right: -50, width: 200, height: 200, opacity: 0.1, backgroundColor: '#38BDF8' }]} />

                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Background Glows */}
                    <View style={[styles.bubble, { top: 100, left: -60, backgroundColor: COLORS.purpleBubble }]} />
                    <View style={[styles.bubble, { top: 400, right: -80, width: 250, height: 250, backgroundColor: COLORS.cyanBubble }]} />

                    <View style={styles.section}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>DISPLAY NAME</Text>
                        <View style={[styles.inputWrapper, { backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
                            <Ionicons name="person-outline" size={20} color={theme.textMuted} />
                            <TextInput
                                style={[styles.input, { color: theme.textPrimary }]}
                                value={displayName}
                                onChangeText={setDisplayName}
                                placeholder="Enter your name"
                                placeholderTextColor={theme.textMuted}
                            />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>EMAIL ADDRESS</Text>
                        <View style={[styles.inputWrapper, { backgroundColor: 'rgba(30, 41, 59, 0.2)', borderColor: 'rgba(255, 255, 255, 0.05)', opacity: 0.6 }]}>
                            <Ionicons name="mail-outline" size={20} color={theme.textMuted} />
                            <TextInput
                                style={[styles.input, { color: 'rgba(255,255,255,0.5)' }]}
                                value={user?.email}
                                editable={false}
                            />
                        </View>
                        <Text style={[styles.infoText, { color: theme.textMuted }]}>
                            Email cannot be changed for security reasons.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={['#0EA5E9', '#2DD4BF']}
                            style={styles.saveGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveText}>Update Profile</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    bubble: {
        position: 'absolute',
        borderRadius: 150,
        zIndex: 0,
        opacity: 0.15,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
        zIndex: 1,
    },
    scrollContent: {
        padding: 20,
        flexGrow: 1,
    },
    section: {
        marginBottom: 25,
        zIndex: 1,
    },
    label: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    infoText: {
        fontSize: 12,
        marginTop: 8,
        marginLeft: 4,
    },
    saveBtn: {
        height: 58,
        borderRadius: 18,
        overflow: 'hidden',
        marginTop: 30,
        zIndex: 1,
        shadowColor: '#0EA5E9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    saveGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});
