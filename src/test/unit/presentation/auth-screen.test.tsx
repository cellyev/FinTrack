import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { AuthScreen } from '@/features/auth/presentation/screens/AuthScreen';
import { useAuthStore } from '@/features/auth/presentation/auth-store';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

describe('AuthScreen Presentation Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      session: null,
      isLoading: false,
      error: null,
    });
  });

  it('should render sign-in form by default with email and password inputs', () => {
    const { getByText, getByPlaceholderText } = render(<AuthScreen mode="sign-in" />);

    expect(getByText('FinTrack')).toBeTruthy();
    expect(getByText('Masuk ke Akun')).toBeTruthy();
    expect(getByPlaceholderText('nama@email.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
    expect(getByText('Masuk')).toBeTruthy();
  });

  it('should toggle between sign-in and sign-up modes', () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<AuthScreen mode="sign-in" />);

    expect(queryByPlaceholderText('Masukkan nama Anda')).toBeNull();

    // Toggle to Sign Up
    fireEvent.press(getByText('Daftar'));

    expect(getByText('Daftar Akun Baru')).toBeTruthy();
    expect(getByPlaceholderText('Masukkan nama Anda')).toBeTruthy();
  });

  it('should validate empty email and password before submit', async () => {
    const { getByText } = render(<AuthScreen mode="sign-in" />);

    fireEvent.press(getByText('Masuk'));

    await waitFor(() => {
      expect(getByText('Email wajib diisi')).toBeTruthy();
      expect(getByText('Password wajib diisi')).toBeTruthy();
    });
  });

  it('should validate short password length', async () => {
    const { getByText, getByPlaceholderText } = render(<AuthScreen mode="sign-in" />);

    fireEvent.changeText(getByPlaceholderText('nama@email.com'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), '123');

    fireEvent.press(getByText('Masuk'));

    await waitFor(() => {
      expect(getByText('Password minimal 6 karakter')).toBeTruthy();
    });
  });

  it('should toggle password visibility when eye icon button is pressed', async () => {
    const { getByPlaceholderText, getByLabelText } = render(<AuthScreen mode="sign-in" />);

    const passwordInput = getByPlaceholderText('••••••••');
    const eyeButton = getByLabelText('Lihat password');
    expect(eyeButton).toBeTruthy();
    expect(passwordInput.props.secureTextEntry).toBe(true);

    // Tap eye icon to show password
    await act(async () => {
      fireEvent.press(eyeButton);
    });
    expect(passwordInput.props.secureTextEntry).toBe(false);
    expect(getByLabelText('Sembunyikan password')).toBeTruthy();

    // Tap eye icon to hide password again
    await act(async () => {
      fireEvent.press(getByLabelText('Sembunyikan password'));
    });
    expect(passwordInput.props.secureTextEntry).toBe(true);
    expect(getByLabelText('Lihat password')).toBeTruthy();
  });

  it('should clear global auth error when user switches mode or types', async () => {
    useAuthStore.setState({
      error: 'Email atau kata sandi salah. Silakan periksa kembali.',
    });

    const { getByText, queryByText, getByPlaceholderText } = render(<AuthScreen mode="sign-in" />);
    expect(getByText('Email atau kata sandi salah. Silakan periksa kembali.')).toBeTruthy();

    // Switching mode should clear the error
    await act(async () => {
      fireEvent.press(getByText('Daftar'));
    });
    expect(queryByText('Email atau kata sandi salah. Silakan periksa kembali.')).toBeNull();

    // Set error again
    act(() => {
      useAuthStore.setState({ error: 'Koneksi internet bermasalah.' });
    });
    expect(getByText('Koneksi internet bermasalah.')).toBeTruthy();

    // Typing in email input should clear error
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('nama@email.com'), 'a');
    });
    expect(queryByText('Koneksi internet bermasalah.')).toBeNull();
  });
});
