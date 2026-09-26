declare module 'react-native' {
  export interface ViewStyle {
    [key: string]: unknown;
  }
  export interface TextStyle {
    [key: string]: unknown;
  }
  export type StyleProp<T> = T | Array<T | undefined | null | false>;

  export interface StyleSheetNamedStyles {
    [key: string]: ViewStyle | TextStyle;
  }

  export const StyleSheet: {
    create<T extends StyleSheetNamedStyles>(styles: T): T;
  };

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: import('react').ReactNode;
  }
  export const View: import('react').FC<ViewProps>;

  export interface TextProps {
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
    children?: import('react').ReactNode;
  }
  export const Text: import('react').FC<TextProps>;

  export interface TouchableOpacityProps {
    style?: StyleProp<ViewStyle>;
    onPress?: () => void | Promise<void>;
    disabled?: boolean;
    children?: import('react').ReactNode;
  }
  export const TouchableOpacity: import('react').FC<TouchableOpacityProps>;

  export interface TextInputProps {
    style?: StyleProp<TextStyle | ViewStyle>;
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    secureTextEntry?: boolean;
  }
  export const TextInput: import('react').FC<TextInputProps>;

  export interface ActivityIndicatorProps {
    size?: 'small' | 'large' | number;
    color?: string;
  }
  export const ActivityIndicator: import('react').FC<ActivityIndicatorProps>;

  export interface ScrollViewProps extends ViewProps {
    contentContainerStyle?: StyleProp<ViewStyle>;
  }
  export const ScrollView: import('react').FC<ScrollViewProps>;

  export interface FlatListProps<T> {
    data: T[];
    keyExtractor: (item: T, index: number) => string;
    renderItem: (info: { item: T; index: number }) => import('react').ReactElement | null;
    contentContainerStyle?: StyleProp<ViewStyle>;
    ListEmptyComponent?: import('react').ReactElement | import('react').ComponentType | null;
    ListHeaderComponent?: import('react').ReactElement | import('react').ComponentType | null;
  }
  export function FlatList<T>(props: FlatListProps<T>): import('react').ReactElement;

  export const SafeAreaView: import('react').FC<ViewProps>;

  export interface StatusBarProps {
    barStyle?: 'default' | 'light-content' | 'dark-content';
  }
  export const StatusBar: import('react').FC<StatusBarProps>;

  export interface AlertButton {
    text?: string;
    onPress?: () => void | Promise<void>;
    style?: 'default' | 'cancel' | 'destructive';
  }
  export const Alert: {
    alert(title: string, message?: string, buttons?: AlertButton[]): void;
  };
}

declare module 'expo' {
  export function registerRootComponent(component: import('react').ComponentType): void;
}
