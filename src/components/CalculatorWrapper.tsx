import React, { useEffect, useState } from 'react';
import { Calculator } from './Calculator';
import { useCalculatorPersistence } from '../hooks/useCalculatorPersistence';
import { useSupabase } from '../contexts/SupabaseContext';

interface CalculatorWrapperProps {
  livePrice: string;
  selectedCrypto: string;
}

export const CalculatorWrapper: React.FC<CalculatorWrapperProps> = ({ livePrice, selectedCrypto }) => {
  const { inputs, saveField, isLoading } = useCalculatorPersistence();
  const { supabase } = useSupabase();
  
  // Track when crypto changes to save it
  useEffect(() => {
    if (selectedCrypto && selectedCrypto !== inputs.crypto_symbol) {
      saveField('crypto_symbol', selectedCrypto);
    }
  }, [selectedCrypto, inputs.crypto_symbol, saveField]);
  
  // Set event listeners to intercept value changes and storage events
  useEffect(() => {
    // Set up event listeners for localStorage changes
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === 'calculatorSettings') {
        try {
          const newSettings = JSON.parse(event.newValue || '{}');
          const updates = {
            taker_fee: newSettings.takerFee,
            maker_fee: newSettings.makerFee,
            risk_amount: newSettings.riskAmount,
            available_capital: newSettings.availableCapital,
            decimal_places: newSettings.decimalPlaces,
            entry_taker: newSettings.entryTaker,
            entry_maker: newSettings.entryMaker,
            exit_taker: newSettings.exitTaker,
            exit_maker: newSettings.exitMaker,
            test_mode: newSettings.testMode
          };
          
          Object.keys(updates).forEach(key => {
            if (updates[key as keyof typeof updates] === undefined) {
              delete updates[key as keyof typeof updates];
            }
          });
          
          if (Object.keys(updates).length > 0) {
            saveField('updated_at', new Date().toISOString());
          }
        } catch (error) {
          console.error('Error parsing calculator settings from storage event:', error);
        }
      }
    };
    
    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', handleStorageEvent);
    
    // Set up a MutationObserver to watch for input changes in the Calculator component
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'value' && 
            mutation.target instanceof HTMLInputElement) {
          
          const input = mutation.target;
          const name = input.name || input.id;
          
          // Map input names to our storage fields
          const fieldMap: Record<string, keyof typeof inputs> = {
            'entry_price': 'entry_price',
            'entryPrice': 'entry_price',
            'stop_loss': 'stop_loss',
            'stopLoss': 'stop_loss',
            'take_profit_price': 'take_profit_price',
            'takeProfitPrice': 'take_profit_price',
            'risk_amount': 'risk_amount',
            'riskAmount': 'risk_amount',
            'available_capital': 'available_capital',
            'availableCapital': 'available_capital',
            'taker_fee': 'taker_fee',
            'takerFee': 'taker_fee',
            'maker_fee': 'maker_fee',
            'makerFee': 'maker_fee',
            'system_name': 'system_name',
            'systemName': 'system_name',
            'entry_pic_url': 'entry_pic_url',
            'entryPicUrl': 'entry_pic_url',
            'notes': 'notes'
          };
          
          const field = fieldMap[name];
          if (field && input.value !== inputs[field]) {
            saveField(field, input.value);
          }
        }
      });
    });
    
    // Start observing inputs after a delay to ensure the component is mounted
    setTimeout(() => {
      const calculatorInputs = document.querySelectorAll('input, textarea, select');
      calculatorInputs.forEach(input => {
        observer.observe(input, { attributes: true });
      });
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      observer.disconnect();
    };
  }, [inputs, saveField]);
  
  // Simply render the original Calculator component without modifications
  // All persistence logic happens through hooks and event listeners
  return <Calculator livePrice={livePrice} selectedCrypto={selectedCrypto} />;
};