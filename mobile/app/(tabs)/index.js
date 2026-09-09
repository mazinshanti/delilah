import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSaved } from '../../context/SavedContext';
import { searchCars } from '../../lib/api';
import { colors, money, number } from '../../lib/theme';

const examples = ['Corolla 2013', 'Patrol 2020', 'Wrangler 2021', 'Camry 2018'];

export default function SearchScreen() {
  const router = useRouter();
  const { isSaved, toggleSaved } = useSaved();
  const [query, setQuery] = useState('');
  const [condition, setCondition] = useState('used');
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(true);
  const [error, setError] = useState('');

  const subtitle = useMemo(() => {
    if (loading && !complete) return `Scanning Saudi market · ${cars.length} found`;
    if (cars.length) return `${cars.length} cars found across the market`;
    return 'Search marketplaces and dealers in one place.';
  }, [cars.length, loading, complete]);

  async function runSearch(value = query) {
    const q = value.trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setComplete(false);
    setError('');
    setCars([]);
    try {
      const result = await searchCars({ query: q, condition, filters: {} }, (next, meta) => {
        setCars(next);
        setComplete(meta?.complete === true);
      });
      setCars(result.listings);
      setComplete(result.meta?.complete === true);
    } catch (e) {
      setError(e?.message || 'Search unavailable');
    } finally {
      setLoading(false);
    }
  }

  function openCar(car) {
    router.push({
      pathname: '/car/[id]',
      params: {
        id: encodeURIComponent(String(car.id || car.url || car.title)),
        title: String(car.title || ''),
        price: String(car.price ?? car.priceSar ?? ''),
        year: String(car.year ?? ''),
        mileage: String(car.mileage ?? car.mileageKm ?? ''),
        city: String(car.city || ''),
        source: String(car.source || car.seller || ''),
        image: String(car.image || car.displayImage || ''),
        url: String(car.url || car.originalUrl || '')
      }
    });
  }

  const renderCar = ({ item }) => {
    const image = item.image || item.displayImage;
    const mileage = number(item.mileage ?? item.mileageKm);
    return (
      <Pressable style={styles.card} onPress={() => openCar(item)}>
        <View style={styles.photo}>
          {image ? <Image source={{ uri: image }} style={styles.image} /> : <Text style={styles.noImage}>🚙</Text>}
          <View style={styles.sourcePill}><Text style={styles.sourceText}>{item.source || item.seller || 'Market'}</Text></View>
          <Pressable style={styles.heart} onPress={event => { event.stopPropagation?.(); toggleSaved(item); }}>
            <Text style={styles.heartText}>{isSaved(item) ? '♥' : '♡'}</Text>
          </Pressable>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.carTitle} numberOfLines={2}>{item.title || 'Vehicle'}</Text>
          <View style={styles.facts}>
            {item.year ? <Text style={styles.fact}>{item.year}</Text> : null}
            {mileage ? <Text style={styles.fact}>{mileage} km</Text> : null}
            {item.city ? <Text style={styles.fact}>{item.city}</Text> : null}
          </View>
          <Text style={styles.price}>{money(item.price ?? item.priceSar)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={cars}
          keyExtractor={(item, index) => String(item.url || item.id || index)}
          renderItem={renderCar}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.brandRow}>
                <View style={styles.logo}><Text style={styles.logoText}>D</Text></View>
                <View><Text style={styles.brand}>Dalelah</Text><Text style={styles.ar}>دليلة</Text></View>
                <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>Saudi market live</Text></View>
              </View>

              <Text style={styles.eyebrow}>SAUDI AUTOMOTIVE SEARCH</Text>
              <Text style={styles.hero}>One search.{`\n`}<Text style={styles.heroMuted}>The whole market.</Text></Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

              <View style={styles.segment}>
                {['used', 'new'].map(value => (
                  <Pressable key={value} onPress={() => setCondition(value)} style={[styles.segmentButton, condition === value && styles.segmentActive]}>
                    <Text style={[styles.segmentText, condition === value && styles.segmentTextActive]}>{value === 'used' ? 'Used cars' : 'New cars'}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.searchBox}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => runSearch()}
                  placeholder="Corolla 2013 or ابي باترول 2020"
                  placeholderTextColor="#6F757D"
                  style={styles.input}
                  returnKeyType="search"
                />
                <Pressable style={styles.searchButton} onPress={() => runSearch()} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.black} /> : <Text style={styles.searchButtonText}>Search</Text>}
                </Pressable>
              </View>

              <View style={styles.examples}>
                {examples.map(item => <Pressable key={item} onPress={() => runSearch(item)} style={styles.example}><Text style={styles.exampleText}>{item}</Text></Pressable>)}
              </View>

              {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
              {cars.length ? <Text style={styles.resultsTitle}>Best matches</Text> : null}
            </View>
          }
          ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>Tell Dalelah what you want.</Text><Text style={styles.emptyText}>We’ll search the Saudi car market and bring the listings together.</Text></View> : null}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:{flex:1},safe:{flex:1,backgroundColor:colors.bg},content:{padding:20,paddingBottom:110,gap:14},brandRow:{flexDirection:'row',alignItems:'center',marginBottom:42},logo:{width:42,height:42,borderRadius:13,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},logoText:{fontSize:21,fontWeight:'1000',color:colors.black},brand:{color:colors.text,fontSize:20,fontWeight:'900',marginLeft:10},ar:{color:colors.muted,fontSize:10,marginLeft:10,marginTop:-2},live:{marginLeft:'auto',flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:colors.line,borderRadius:999,paddingHorizontal:10,paddingVertical:8},dot:{width:7,height:7,borderRadius:9,backgroundColor:colors.ok,marginRight:6},liveText:{color:'#C5C9CF',fontSize:10,fontWeight:'700'},eyebrow:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.6,marginBottom:10},hero:{color:colors.text,fontSize:46,lineHeight:46,fontWeight:'1000',letterSpacing:-2.2},heroMuted:{color:'#737981'},subtitle:{color:colors.muted,fontSize:14,lineHeight:20,marginTop:16,maxWidth:330},segment:{alignSelf:'flex-start',flexDirection:'row',backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:14,padding:4,marginTop:24},segmentButton:{paddingHorizontal:16,paddingVertical:10,borderRadius:10},segmentActive:{backgroundColor:colors.accent},segmentText:{color:colors.muted,fontSize:12,fontWeight:'800'},segmentTextActive:{color:colors.black},searchBox:{flexDirection:'row',alignItems:'center',backgroundColor:colors.panel,borderWidth:1,borderColor:'#3A4048',borderRadius:20,padding:7,marginTop:12},input:{flex:1,color:colors.text,fontSize:15,paddingHorizontal:12,paddingVertical:13},searchButton:{backgroundColor:colors.accent,borderRadius:14,paddingHorizontal:18,paddingVertical:13,minWidth:78,alignItems:'center'},searchButtonText:{color:colors.black,fontSize:12,fontWeight:'1000'},examples:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10,marginBottom:22},example:{borderWidth:1,borderColor:colors.line,borderRadius:999,paddingHorizontal:10,paddingVertical:7},exampleText:{color:'#B7BCC4',fontSize:10,fontWeight:'700'},resultsTitle:{color:colors.text,fontSize:25,fontWeight:'1000',marginTop:6,marginBottom:0},error:{backgroundColor:'#26191B',borderWidth:1,borderColor:'#66383E',padding:12,borderRadius:12,marginBottom:16},errorText:{color:colors.bad,fontSize:12},card:{backgroundColor:colors.panel,borderWidth:1,borderColor:'#282D33',borderRadius:19,overflow:'hidden',marginBottom:2},photo:{height:205,backgroundColor:colors.panel2,alignItems:'center',justifyContent:'center'},image:{width:'100%',height:'100%',resizeMode:'cover'},noImage:{fontSize:45},sourcePill:{position:'absolute',top:10,right:10,backgroundColor:'rgba(9,10,11,.86)',paddingHorizontal:9,paddingVertical:6,borderRadius:999},sourceText:{color:colors.text,fontSize:8,fontWeight:'900'},heart:{position:'absolute',top:9,left:9,width:34,height:34,borderRadius:17,backgroundColor:'rgba(9,10,11,.86)',alignItems:'center',justifyContent:'center'},heartText:{color:colors.accent,fontSize:19,fontWeight:'900'},cardBody:{padding:15},carTitle:{color:colors.text,fontSize:18,fontWeight:'900',lineHeight:23},facts:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:9},fact:{color:'#C2C7CD',backgroundColor:'#1C2025',fontSize:9,fontWeight:'700',paddingHorizontal:7,paddingVertical:6,borderRadius:7},price:{color:colors.text,fontSize:23,fontWeight:'1000',marginTop:12},empty:{alignItems:'center',paddingVertical:50,paddingHorizontal:24},emptyIcon:{color:colors.accent,fontSize:28},emptyTitle:{color:colors.text,fontSize:18,fontWeight:'900',marginTop:10},emptyText:{color:colors.muted,textAlign:'center',fontSize:12,lineHeight:18,marginTop:7,maxWidth:280}
});
