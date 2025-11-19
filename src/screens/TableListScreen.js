import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tableService } from "../services/tableService";
import { listAreas } from "../services/areaService";
import { sessionService } from "../services/sessionService";
import Header from "../components/Header";
import Menu from "../components/Menu"; // ✅ THÊM: Import Menu component

export default function TableListScreen({ navigation }) {
  const [tables, setTables] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [realTimeData, setRealTimeData] = useState({});
  const [menuVisible, setMenuVisible] = useState(false); // ✅ THÊM: State cho menu

  // ✅ SỬA: Handle menu và notification giống HomeScreen
  const handleMenuPress = () => {
    console.log('Menu pressed');
    setMenuVisible(true); // ✅ Show menu thay vì drawer
  };

  const handleNotificationPress = () => {
    console.log('Notification pressed');
    navigation.navigate('Notifications'); // ✅ Navigate đến screen đúng
  };

  const loadAreas = useCallback(async () => {
    try {
      const response = await listAreas();
      
      if (response?.data?.data) {
        const areasData = response.data.data;
        setAreas(areasData);
        
        if (areasData.length > 0) {
          const firstAreaId = areasData[0].id || areasData[0]._id;
          setSelectedArea(firstAreaId);
        }
      }
    } catch (error) {
      console.error('Error loading areas:', error);
      setAreas([]);
    }
  }, []);

  const loadTables = useCallback(async () => {
    try {
      const res = await tableService.list({ 
        limit: 100, 
        sort: "orderIndex",
        active: true
      });
      
      if (res?.data?.items) {
        setTables(res.data.items);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
      setTables([]);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const response = await sessionService.list({ status: 'open', limit: 100 });
      
      let sessionsData = [];
      
      if (response?.data?.items) {
        sessionsData = response.data.items;
      } else if (response?.items) {
        sessionsData = response.items;
      } else if (response?.data) {
        sessionsData = Array.isArray(response.data) ? response.data : [response.data];
      } else if (Array.isArray(response)) {
        sessionsData = response;
      }
      
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessions([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadAreas(), loadTables(), loadSessions()]);
    } finally {
      setLoading(false);
    }
  }, [loadAreas, loadTables, loadSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTables(), loadSessions()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadTables, loadSessions]);

  const updateRealTimeData = useCallback(() => {
    if (sessions.length === 0) return;
    
    const newRealTimeData = {};
    
    tables.forEach(table => {
      if (table.status === 'playing') {
        const session = sessions.find(s => 
          String(s.table) === String(table._id || table.id) ||
          (s.status === 'open')
        );
        
        if (session?.startTime) {
          const now = new Date();
          const start = new Date(session.startTime);
          const diffInMinutes = Math.floor((now - start) / (1000 * 60));
          
          if (diffInMinutes >= 0) {
            const hours = Math.floor(diffInMinutes / 60);
            const minutes = diffInMinutes % 60;
            const timeString = hours > 0 
              ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}` 
              : `${minutes}m`;
              
            newRealTimeData[table._id || table.id] = timeString;
          }
        }
      }
    });
    
    setRealTimeData(newRealTimeData);
  }, [tables, sessions]);

  useEffect(() => {
    loadData();
    
    // Auto refresh data every 30 seconds
    const dataInterval = setInterval(() => {
      loadTables();
      loadSessions();
    }, 30000);

    return () => clearInterval(dataInterval);
  }, [loadData, loadTables, loadSessions]);

  useEffect(() => {
    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
      updateRealTimeData();
    }, 1000);

    return () => clearInterval(timeInterval);
  }, [updateRealTimeData]);

  useEffect(() => {
    // Update real-time data when sessions or tables change
    if (tables.length > 0 && sessions.length > 0) {
      updateRealTimeData();
    }
  }, [tables, sessions, updateRealTimeData]);

  const getStatusText = useCallback((table) => {
    switch (table.status) {
      case 'playing':
        const tableId = table._id || table.id;
        const realTime = realTimeData[tableId];
        return realTime || '0m';
      case 'reserved':
        return 'Đã đặt';
      case 'maintenance':
        return 'Bảo trì';
      default:
        return 'Trống';
    }
  }, [realTimeData]);

  const filteredTables = tables.filter(table => {
    if (!selectedArea) {
      return true;
    }
    
    const tableAreaId = table.areaId?._id || table.areaId?.id || table.areaId;
    const isMatch = String(tableAreaId) === String(selectedArea);
    
    return isMatch;
  });

  const mappedTables = filteredTables.map(table => {
    const session = sessions.find(s => String(s.table) === String(table._id || table.id));
    const tableId = table._id || table.id;
    const timeUsed = table.status === 'playing' ? (realTimeData[tableId] || '0m') : '';
    
    return {
      id: tableId,
      name: table.name,
      status: table.status,
      timeUsed: timeUsed,
      areaId: table.areaId?._id || table.areaId?.id || table.areaId,
      areaName: table.areaId?.name || 'Chưa phân vùng',
      sessionId: session?._id || session?.id || null,
      ratePerHour: table.ratePerHour || 0,
      itemsCount: session?.items?.length || 0,
      active: table.active
    };
  });

  const totalTables = mappedTables.length;
  const playingTables = mappedTables.filter(table => table.status === 'playing').length;
  const availableTables = mappedTables.filter(table => table.status === 'available').length;
  const reservedTables = mappedTables.filter(table => table.status === 'reserved').length;
  const maintenanceTables = mappedTables.filter(table => table.status === 'maintenance').length;

  const handleTablePress = (table) => {
    if (table.status === 'available') {
      navigation.navigate('OrderScreen', { 
        tableId: table.id,
        tableName: table.name,
        ratePerHour: table.ratePerHour
      });
    } else if (table.status === 'playing') {
      navigation.navigate('OrderDetail', { 
        tableId: table.id,
        tableName: table.name,
        sessionId: table.sessionId,
        timeUsed: table.timeUsed,
        itemsCount: table.itemsCount
      });
    }
  };

  const handleAreaPress = (area) => {
    const areaId = area.id || area._id;
    setSelectedArea(areaId);
  };

  const renderAreaItem = ({ item }) => {
    const itemId = item.id || item._id;
    const isSelected = selectedArea === itemId;
    
    return (
      <TouchableOpacity 
        style={[
          styles.areaButton,
          isSelected && styles.selectedAreaButton,
          isSelected && { backgroundColor: item.color || '#fff' }
        ]}
        onPress={() => handleAreaPress(item)}
      >
        <Text style={[
          styles.areaText,
          isSelected && styles.selectedAreaText
        ]}>
          {item.name}
        </Text>
        {isSelected && <View style={styles.selectedIndicator} />}
      </TouchableOpacity>
    );
  };

  const getTableCardStyle = (status) => {
    switch (status) {
      case 'playing':
        return styles.playingCard;
      case 'reserved':
        return styles.reservedCard;
      case 'maintenance':
        return styles.maintenanceCard;
      default:
        return styles.availableCard;
    }
  };

  const getTableTextStyle = (status) => {
    switch (status) {
      case 'playing':
      case 'reserved':
      case 'maintenance':
        return styles.whiteText;
      default:
        return styles.darkText;
    }
  };

  const renderTableItem = ({ item }) => {
    const statusText = getStatusText(item);
    
    return (
      <TouchableOpacity
        style={[styles.tableCard, getTableCardStyle(item.status)]}
        onPress={() => handleTablePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.tableContent}>
          <Text style={[styles.tableNumber, getTableTextStyle(item.status)]}>
            {item.name.replace('Bàn ', '').replace('VIP ', '')}
          </Text>
          
          <Text style={[styles.tableRate, getTableTextStyle(item.status)]}>
            {(item.ratePerHour / 1000).toFixed(0)}k/h
          </Text>
          
          <Text style={[styles.statusText, getTableTextStyle(item.status)]}>
            {statusText}
          </Text>

          {item.itemsCount > 0 && (
            <View style={styles.itemsBadge}>
              <Text style={styles.itemsBadgeText}>{item.itemsCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        
        {/* ✅ SỬA: Header + Menu giống HomeScreen */}
        <Header 
          onMenuPress={handleMenuPress}
          onNotificationPress={handleNotificationPress}
        />

        <Menu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          navigation={navigation}
        />

        <View style={styles.loadingContainer}>
          <Text>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      
      {/* ✅ SỬA: Header + Menu giống HomeScreen */}
      <Header 
        onMenuPress={handleMenuPress}
        onNotificationPress={handleNotificationPress}
      />

      <Menu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
      />

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Đang chơi: </Text>
          <Text style={[styles.statValue, { color: '#007AFF' }]}>{playingTables}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Trống: </Text>
          <Text style={[styles.statValue, { color: '#34C759' }]}>{availableTables}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Đặt: </Text>
          <Text style={[styles.statValue, { color: '#5856D6' }]}>{reservedTables}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Bảo trì: </Text>
          <Text style={[styles.statValue, { color: '#FF9500' }]}>{maintenanceTables}</Text>
        </View>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.sidebar}>
          {areas.length > 0 ? (
            <FlatList
              data={areas}
              keyExtractor={(area) => area.id || area._id}
              renderItem={renderAreaItem}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.noAreasContainer}>
              <Text style={styles.noAreasText}>Không có khu vực</Text>
            </View>
          )}
        </View>

        <View style={styles.tableArea}>
          {mappedTables.length > 0 ? (
            <FlatList
              data={mappedTables}
              renderItem={renderTableItem}
              keyExtractor={(item) => item.id?.toString()}
              numColumns={3}
              contentContainerStyle={styles.tableGrid}
              columnWrapperStyle={styles.row}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#007AFF']}
                />
              }
            />
          ) : selectedArea ? (
            <View style={styles.noTablesContainer}>
              <Text style={styles.noTablesText}>
                Khu vực này chưa có bàn nào
              </Text>
            </View>
          ) : (
            <View style={styles.noTablesContainer}>
              <Text style={styles.noTablesText}>
                Chọn khu vực để xem bàn
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ✅ SỬA: Thay SafeAreaView thành View để giống HomeScreen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8e6f0', // ✅ Hoặc đổi thành '#f5f5f5' như HomeScreen
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 80,
    backgroundColor: '#d8d6e8',
    paddingVertical: 10,
  },
  areaButton: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginVertical: 5,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  selectedAreaButton: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  areaText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedAreaText: {
    color: '#333',
    fontWeight: 'bold',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  noAreasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  noAreasText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  tableArea: {
    flex: 1,
    backgroundColor: '#e8e6f0',
  },
  noTablesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noTablesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  tableGrid: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  row: {
    justifyContent: 'flex-start',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  tableCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginHorizontal: 5,
  },
  availableCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  playingCard: {
    backgroundColor: '#007AFF',
  },
  reservedCard: {
    backgroundColor: '#5856D6',
  },
  maintenanceCard: {
    backgroundColor: '#FF9500',
  },
  tableContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    position: 'relative',
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tableRate: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  darkText: {
    color: '#333',
  },
  whiteText: {
    color: '#fff',
  },
  itemsBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});