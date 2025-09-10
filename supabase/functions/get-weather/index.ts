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
      return new Response(JSON.stringify({ error: 'OpenWeatherMap API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch current weather (in Fahrenheit)
    const currentWeatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=imperial`
    );

    if (!currentWeatherResponse.ok) {
      console.error('OpenWeatherMap API error:', await currentWeatherResponse.text());
      return new Response(JSON.stringify({ error: 'Failed to fetch weather data' }), {
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

    // Process forecast data to get daily summaries with better weather predictions
    const dailyForecast = [];
    const dailyData = new Map();

    // Group forecast data by date and find the most representative weather for each day
    forecast.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          date: dateKey,
          temps: [],
          conditions: [],
          icons: [],
          humidity: [],
          windSpeed: [],
          weatherCounts: new Map()
        });
      }
      
      const dayData = dailyData.get(dateKey);
      dayData.temps.push(item.main.temp);
      dayData.conditions.push(item.weather[0].description);
      dayData.icons.push(item.weather[0].icon);
      dayData.humidity.push(item.main.humidity);
      dayData.windSpeed.push(item.wind.speed);
      
      // Count weather conditions to find the most common one for the day
      const weatherKey = item.weather[0].main;
      dayData.weatherCounts.set(weatherKey, (dayData.weatherCounts.get(weatherKey) || 0) + 1);
    });

    // Process each day to get the most representative weather
    dailyData.forEach((dayData, dateKey) => {
      // Find the most common weather condition for the day
      let mostCommonWeather = '';
      let maxCount = 0;
      dayData.weatherCounts.forEach((count, weather) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonWeather = weather;
        }
      });
      
      // Find the icon that corresponds to the most common weather
      let representativeIcon = dayData.icons[0];
      for (let i = 0; i < dayData.conditions.length; i++) {
        if (dayData.conditions[i].toLowerCase().includes(mostCommonWeather.toLowerCase())) {
          representativeIcon = dayData.icons[i];
          break;
        }
      }
      
      dailyForecast.push({
        date: dateKey,
        temp: Math.round(dayData.temps.reduce((a, b) => a + b, 0) / dayData.temps.length), // Average temp
        maxTemp: Math.round(Math.max(...dayData.temps)),
        minTemp: Math.round(Math.min(...dayData.temps)),
        description: mostCommonWeather,
        icon: representativeIcon,
        humidity: Math.round(dayData.humidity.reduce((a, b) => a + b, 0) / dayData.humidity.length),
        windSpeed: Math.round(dayData.windSpeed.reduce((a, b) => a + b, 0) / dayData.windSpeed.length * 10) / 10,
      });
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