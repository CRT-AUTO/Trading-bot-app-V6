import { useState, useEffect } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { useAuth } from '../contexts/AuthContext';

// Define the type for calculator inputs
type CalculatorInputs = {
  crypto_symbol: string;
  entry_price: string;
  stop_loss: string;
  take_profit_price: string;
  risk_amount: string;
  available_capital: string;
  taker_fee: string;
  maker_fee: string;
  direction: 'long' | 'short';
  decimal_places: number;
  entry_taker: boolean;
  entry_maker: boolean;
  exit_taker: boolean;
  exit_maker: boolean;
  test_mode: boolean;
  system_name: string;
  entry_pic_url: string;
  notes: string;
  api_key_id: string | null; // Changed from string to string | null
};

// Default values
const DEFAULT_INPUTS: CalculatorInputs = {
  crypto_symbol: 'BTCUSDT',
  entry_price: '',
  stop_loss: '',
  take_profit_price: '',
  risk_amount: '1',
  available_capital: '100',
  taker_fee: '0.055',
  maker_fee: '0.02',
  direction: 'long',
  decimal_places: 4,
  entry_taker: true,
  entry_maker: false,
  exit_taker: true,
  exit_maker: false,
  test_mode: false,
  system_name: '',
  entry_pic_url: '',
  notes: '',
  api_key_id: null, // Changed from empty string to null
};

export const useCalculatorPersistence = () => {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load calculator inputs from localStorage first (for faster initial load and fallback)
  useEffect(() => {
    const savedSettings = localStorage.getItem('calculatorSettings');
    const savedInputs = localStorage.getItem('calculatorInputs');
    
    // Combine both types of saved data
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setInputs(prevInputs => ({
          ...prevInputs,
          taker_fee: settings.takerFee || prevInputs.taker_fee,
          maker_fee: settings.makerFee || prevInputs.maker_fee,
          risk_amount: settings.riskAmount || prevInputs.risk_amount,
          available_capital: settings.availableCapital || prevInputs.available_capital,
          decimal_places: settings.decimalPlaces || prevInputs.decimal_places,
          entry_taker: settings.entryTaker !== undefined ? settings.entryTaker : prevInputs.entry_taker,
          entry_maker: settings.entryMaker !== undefined ? settings.entryMaker : prevInputs.entry_maker,
          exit_taker: settings.exitTaker !== undefined ? settings.exitTaker : prevInputs.exit_taker,
          exit_maker: settings.exitMaker !== undefined ? settings.exitMaker : prevInputs.exit_maker,
          test_mode: settings.testMode !== undefined ? settings.testMode : prevInputs.test_mode,
        }));
      } catch (error) {
        console.error('Error parsing calculator settings from localStorage:', error);
      }
    }
    
    // Load full inputs if available
    if (savedInputs) {
      try {
        const parsedInputs = JSON.parse(savedInputs);
        setInputs(prevInputs => ({
          ...prevInputs,
          ...parsedInputs
        }));
      } catch (error) {
        console.error('Error parsing calculator inputs from localStorage:', error);
      }
    }
  }, []);
  
  // Load inputs from database when user is authenticated
  useEffect(() => {
    const loadFromDatabase = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Check if the user has saved inputs
        // Removed .single() to avoid PGRST116 error when no rows exist
        const { data, error } = await supabase
          .from('calculator_inputs')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('Error loading calculator inputs:', error);
          return;
        }
        
        // Check if data exists and has at least one row
        if (data && data.length > 0) {
          // Transform the database data into the inputs format
          const loadedInputs: CalculatorInputs = {
            crypto_symbol: data[0].crypto_symbol || DEFAULT_INPUTS.crypto_symbol,
            entry_price: data[0].entry_price || '',
            stop_loss: data[0].stop_loss || '',
            take_profit_price: data[0].take_profit_price || '',
            risk_amount: data[0].risk_amount || DEFAULT_INPUTS.risk_amount,
            available_capital: data[0].available_capital || DEFAULT_INPUTS.available_capital,
            taker_fee: data[0].taker_fee || DEFAULT_INPUTS.taker_fee,
            maker_fee: data[0].maker_fee || DEFAULT_INPUTS.maker_fee,
            direction: (data[0].direction as 'long' | 'short') || DEFAULT_INPUTS.direction,
            decimal_places: data[0].decimal_places || DEFAULT_INPUTS.decimal_places,
            entry_taker: data[0].entry_taker !== null ? data[0].entry_taker : DEFAULT_INPUTS.entry_taker,
            entry_maker: data[0].entry_maker !== null ? data[0].entry_maker : DEFAULT_INPUTS.entry_maker,
            exit_taker: data[0].exit_taker !== null ? data[0].exit_taker : DEFAULT_INPUTS.exit_taker,
            exit_maker: data[0].exit_maker !== null ? data[0].exit_maker : DEFAULT_INPUTS.exit_maker,
            test_mode: data[0].test_mode !== null ? data[0].test_mode : DEFAULT_INPUTS.test_mode,
            system_name: data[0].system_name || '',
            entry_pic_url: data[0].entry_pic_url || '',
            notes: data[0].notes || '',
            api_key_id: data[0].api_key_id || null, // Changed to handle null
          };
          
          setInputs(loadedInputs);
          
          // Also save to localStorage for offline use and faster loading next time
          localStorage.setItem('calculatorInputs', JSON.stringify(loadedInputs));
        }
      } catch (error) {
        console.error('Error in loadFromDatabase:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFromDatabase();
  }, [user, supabase]);
  
  // Save inputs to database and localStorage
  const saveInputs = async (newInputs: Partial<CalculatorInputs>) => {
    // First update local state
    setInputs(prev => {
      const updated = { ...prev, ...newInputs };
      
      // Save to localStorage immediately
      localStorage.setItem('calculatorInputs', JSON.stringify(updated));
      return updated;
    });
    
    // Then save to database if user is logged in
    if (user) {
      try {
        const { data, error: checkError } = await supabase
          .from('calculator_inputs')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        
        if (checkError) {
          console.error('Error checking for existing calculator inputs:', checkError);
          return;
        }
        
        // Process api_key_id to ensure it's a valid UUID or null
        const processedInputs = { ...newInputs };
        if (processedInputs.api_key_id === '') {
          processedInputs.api_key_id = null;
        }
        
        if (data && data.length > 0) {
          // Update existing record
          const { error } = await supabase
            .from('calculator_inputs')
            .update({
              ...processedInputs,
              updated_at: new Date().toISOString()
            })
            .eq('id', data[0].id);
          
          if (error) {
            console.error('Error updating calculator inputs:', error);
          }
        } else {
          // Insert new record
          const cleanInputs = { ...inputs };
          // Ensure api_key_id is either a valid UUID or null, not an empty string
          if (cleanInputs.api_key_id === '') {
            cleanInputs.api_key_id = null;
          }
          
          const { error } = await supabase
            .from('calculator_inputs')
            .insert({
              user_id: user.id,
              ...cleanInputs, // Include existing values
              ...processedInputs, // Override with new values
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (error) {
            console.error('Error inserting calculator inputs:', error);
          }
        }
      } catch (error) {
        console.error('Error saving calculator inputs:', error);
      }
    }
  };
  
  // Save specific field
  const saveField = async (field: keyof CalculatorInputs, value: any) => {
    // Special handling for api_key_id to ensure empty strings are converted to null
    const processedValue = field === 'api_key_id' && value === '' ? null : value;
    await saveInputs({ [field]: processedValue } as Partial<CalculatorInputs>);
  };
  
  // Save multiple fields at once
  const saveFields = async (updates: Partial<CalculatorInputs>) => {
    // Process api_key_id if it exists in updates
    if ('api_key_id' in updates && updates.api_key_id === '') {
      updates.api_key_id = null;
    }
    await saveInputs(updates);
  };
  
  return {
    inputs,
    setInputs: saveInputs,
    saveField,
    saveFields,
    isLoading
  };
};