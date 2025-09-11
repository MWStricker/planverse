import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openWeatherApiKey = Deno.env.get('OPENWEATHERMAP_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lon } = await req.json();

    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: 'Latitude and longitude are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!openWeatherApiKey) {
      console.error('OpenWeatherMap API key not found in environment variables');
      return new Response(JSON.stringify({ error: 'OpenWeatherMap API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch current weather (in Fahrenheit)
    console.log(`Fetching weather for lat: ${lat}, lon: ${lon}`);
    const currentWeatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=imperial`
    );

    if (!currentWeatherResponse.ok) {
      const errorText = await currentWeatherResponse.text();
      console.error('OpenWeatherMap API error:', errorText);
      console.error('Status:', currentWeatherResponse.status);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch weather data',
        details: errorText,
        status: currentWeatherResponse.status 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentWeather = await currentWeatherResponse.json();

    // Fetch 5-day forecast (in Fahrenheit) - this gives us up to 5 days with 3-hour intervals
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=imperial`
    );

    if (!forecastResponse.ok) {
      console.error('OpenWeatherMap forecast API error:', await forecastResponse.text());
      return new Response(JSON.stringify({ error: 'Failed to fetch forecast data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const forecast = await forecastResponse.json();

    // Process forecast data with enhanced accuracy and time-based selection
    const dailyForecast = [];
    const dailyData = new Map();

    // Group forecast data by date and prioritize daytime hours for more accurate daily weather
    forecast.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      const hour = date.getHours();
      
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          date: dateKey,
          allTemps: [],
          daytimeData: [],
          allData: [],
          weatherCounts: new Map()
        });
      }
      
      const dayData = dailyData.get(dateKey);
      
      // Store all temperature data for accurate min/max calculation
      dayData.allTemps.push(item.main.temp);
      dayData.allData.push({
        temp: item.main.temp,
        condition: item.weather[0].main,
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        humidity: item.main.humidity,
        windSpeed: item.wind.speed,
        hour: hour,
        timestamp: item.dt
      });
      
      // Prioritize daytime hours (9 AM to 6 PM) for weather condition selection
      if (hour >= 9 && hour <= 18) {
        dayData.daytimeData.push({
          temp: item.main.temp,
          condition: item.weather[0].main,
          description: item.weather[0].description,
          icon: item.weather[0].icon,
          humidity: item.main.humidity,
          windSpeed: item.wind.speed,
          hour: hour
        });
      }
      
      // Count weather conditions for overall trend
      const weatherKey = item.weather[0].main;
      dayData.weatherCounts.set(weatherKey, (dayData.weatherCounts.get(weatherKey) || 0) + 1);
    });

    // Process each day to get the most accurate weather representation
    dailyData.forEach((dayData, dateKey) => {
      let representativeWeather;
      
      // Use daytime data if available for more accurate daily conditions
      if (dayData.daytimeData.length > 0) {
        // Prefer midday conditions (12-15) for most accurate daily weather
        const midDayData = dayData.daytimeData.filter(d => d.hour >= 12 && d.hour <= 15);
        representativeWeather = midDayData.length > 0 
          ? midDayData[Math.floor(midDayData.length / 2)]
          : dayData.daytimeData[Math.floor(dayData.daytimeData.length / 2)];
      } else {
        // Fallback to all available data
        representativeWeather = dayData.allData[Math.floor(dayData.allData.length / 2)];
      }
      
      if (representativeWeather) {
        dailyForecast.push({
          date: dateKey,
          temp: Math.round(representativeWeather.temp),
          maxTemp: Math.round(Math.max(...dayData.allTemps)),
          minTemp: Math.round(Math.min(...dayData.allTemps)),
          description: representativeWeather.condition,
          icon: representativeWeather.icon,
          humidity: Math.round(representativeWeather.humidity),
          windSpeed: Math.round(representativeWeather.windSpeed * 10) / 10,
        });
      }
    });

    const weatherData = {
      current: {
        temp: Math.round(currentWeather.main.temp),
        description: currentWeather.weather[0].description,
        icon: currentWeather.weather[0].icon,
        humidity: currentWeather.main.humidity,
        windSpeed: currentWeather.wind.speed,
        location: currentWeather.name,
      },
      forecast: dailyForecast, // All available forecast days (up to 5 days)
    };

    return new Response(JSON.stringify(weatherData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-weather function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});