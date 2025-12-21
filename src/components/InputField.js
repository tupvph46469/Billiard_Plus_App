// src/components/InputField.js
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

// SỬ DỤNG NAMED EXPORT để chắc chắn
export const InputField = ({
    label,
    value,
    placeholder,
    onChangeText,
    secureTextEntry = false,
    keyboardType = 'default',
    error = null,
    editable = true,
    ...props
}) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    !editable && styles.inputDisabled,
                    error && styles.inputError,
                ]}
                value={value}
                placeholder={placeholder || label}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                editable={editable}
                placeholderTextColor="#9ca3af"
                {...props}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: 16, width: '100%' },
    label: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
    input: { height: 50, backgroundColor: '#f9fafb', borderRadius: 8, paddingHorizontal: 12, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb' },
    inputDisabled: { backgroundColor: '#f3f4f6', color: '#6b7280' },
    inputError: { borderColor: '#ef4444', borderWidth: 2 },
    errorText: { fontSize: 12, color: '#ef4444', marginTop: 4 },
});
// Vui lòng làm tương tự với CustomButton.js nếu nó cũng bị lỗi.