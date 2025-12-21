// TRONG FILE: src/components/CustomButton.js
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

export const CustomButton = ({ 
    title, 
    onPress, 
    disabled = false, 
    loading = false, 
    buttonStyle, 
    textStyle 
}) => {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.button,
                buttonStyle,
                (disabled || loading) && styles.buttonDisabled,
                pressed && !disabled && !loading && styles.buttonPressed,
            ]}
        >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={[styles.buttonText, textStyle]}>{title}</Text>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonPressed: {
        backgroundColor: '#005bb5',
    },
    buttonDisabled: {
        backgroundColor: '#a3a3a3',
    },
});

// KHÔNG dùng export default