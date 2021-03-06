import React, { useEffect } from 'react'
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ToastAndroid,
} from 'react-native'
import styles from '../styles/index'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faFileCsv,
    faTrash
} from '@fortawesome/free-solid-svg-icons';
import { SwipeListView } from 'react-native-swipe-list-view';
import getRealm from '../services/realm';
import { format } from 'date-fns';
import pt from 'date-fns/locale/pt-BR';
import FilePickerManager from 'react-native-file-picker';
import { useReadings } from '../context'
import RNFetchBlob from 'react-native-fetch-blob';

const ReadingsList = ({ navigation }) => {
    const { readings, setReadings } = useReadings()

    useEffect(() => {
        loadReadings(); //TODA VEZ QUE A LISTA DE LEITURAS SER ALTERADA, SOFRERÁ ATUALIZAÇÃO
    }, []);

    //FUNÇÃO PARA ATUALIZAÇÃO DA LISTA
    async function loadReadings() {
        const realm = await getRealm();
        const data = realm.objects('Reading').sorted('id', true);
        setReadings(data)
        global.empty_list = readings.length == 0 ? true : false;
    }

    //REMOVE UMA LEITURA DO BANCO DE DADOS
    async function deleteReading(data) {
        try {
            const realm = await getRealm();
            let leitura = realm.objects('Reading').filtered(`id == ${data.id}`);

            realm.write(() => {
                realm.delete(leitura)
            });
            loadReadings()
            ToastAndroid.showWithGravity(
                `Leitura removida com sucesso`,
                ToastAndroid.SHORT,
                ToastAndroid.CENTER
            );
        } catch (err) {
            console.log(err)
        }
    }

    //EXPORTA UMA ARQUIVO .CSV NA PASTA DOWNLOADS COM AS INFORMAÇÕES DA LEITURA SELECIONADA
    async function exportCsv(data) {
        try {
            const realm = await getRealm();
            let leitura = realm.objects('Reading').filtered(`id == ${data.id}`);

            console.log('Arquivo a ser exportado: ', leitura[0].id)

            const freq = leitura[0].freqs.split(',').map(Number)
            const time = leitura[0].times.split(',').map(Number)

            const rowString = time.map(function (e, i) {
                return ['"' + String(e) + '"', (i == time.length - 1 ? '"' + String(freq[i]) + '"' : '"' + String(freq[i]) + '"\n')];
            }).join('');

            const date = format(
                new Date(leitura[0].timeStamp),
                "yyyy'-'MM'-'dd'T'HHmm'",
            )

            const csvString = `${rowString}`;
            const label = `SIGNAPP_${date}.csv`

            const pathToWrite = `${RNFetchBlob.fs.dirs.DownloadDir}/${label}`;
            console.log('pathToWrite', pathToWrite);
            RNFetchBlob.fs
                .writeFile(pathToWrite, csvString, 'utf8')
                .then(() => {
                    console.log(`wrote file ${pathToWrite}`);
                    ToastAndroid.showWithGravity(
                        `Arquivo .csv criado na pasta Downloads`,
                        ToastAndroid.SHORT,
                        ToastAndroid.CENTER
                    );

                })
                .catch(error => console.error(error));
        } catch (err) {
            console.log(err)
        }
    }

    //JANELA DE ALERTA PARA CONFIRMAR A REMOÇÃO DE UMA LEITURA DO BANCO DE DADOS
    function confirmDeletion(data) {
        Alert.alert(
            "",
            "Você tem certeza que deseja remover esta leitura?",
            [
                {
                    text: "Não",
                    onPress: () => console.log("Cancel Pressed"),
                    style: "cancel"
                },
                {
                    text: "Sim", onPress: () =>
                        deleteReading(data)
                }
            ],
            { cancelable: false }
        );
    }

    //FUNÇÃO PARA CERTIFICAR QUE O USUÁRIO JÁ SE CONECTOU AO DISPOSITIVO ANTES DE INICIAR A PLOTAGEM 
    function goToPlot() {
        if (global.connected) {
            navigation.navigate('Plot Real Time')
        } else {
            Alert.alert(
                "",
                "Conecte-se a um dispositivo antes de iniciar uma nova leitura.",
                [
                    {
                        text: "Cancelar",
                        onPress: () => console.log("Cancel Pressed"),
                        style: "cancel"
                    },
                    {
                        text: "Ir para Configurações", onPress: () =>
                            navigation.navigate('Settings')
                    }
                ],
                { cancelable: false }
            );
        }
    }

    //FUNÇÃO PARA CARREGAR O ARQUIVO .CSV EXISTENTE
    function uploadFile() {
        FilePickerManager.showFilePicker(null, (response) => {

            if (response.didCancel) {
                console.log('User cancelled file picker');
            }
            else if (response.error) {
                console.log('FilePickerManager Error: ', response.error);
            }
            else if (response.path.includes("SIGNAPP")) {
                navigation.navigate('Plot Existing Chart',
                    {
                        'path': response.path
                    }
                )
            }
            else {
                console.log('Not an SIGNAPP.csv file');
                ToastAndroid.show("Arquivo inválido. Por favor, adicione um arquivo do tipo SIGNAPP.csv", ToastAndroid.SHORT);
            }
        });
    }

    return (
        <View style={styles.listContainer}>
            <Text
                style={[styles.settingTitle, { marginBottom: 20 }]}>Suas Leituras</Text>
            <SwipeListView
                data={readings}
                renderItem={(data, rowMap) => (
                    <View style={styles.readingItem}>
                        <TouchableOpacity
                            onPress={(() => {
                                navigation.navigate('Plot Existing Chart',
                                    {
                                        'data': data.item.id
                                    }
                                )
                            })}>
                            <Text
                                style={{ fontSize: 17 }}>
                                {format(
                                    new Date(data.item.timeStamp),
                                    "dd 'de' MMMM' às 'HH'h'mm",
                                    { locale: pt }
                                )}</Text>
                            <Text
                                style={{ fontSize: 10 }}>
                                {`#${data.item.id}`}</Text>
                        </TouchableOpacity>
                    </View>
                )}
                renderHiddenItem={(data, rowMap) => (
                    <View style={styles.rowSwipe}>
                        <TouchableOpacity
                            onPress={() => {
                                exportCsv(data.item)
                            }}>
                            <FontAwesomeIcon
                                style={[styles.exportSwipe, { margin: 5 }]}
                                icon={faFileCsv}
                                color={'blue'}
                                size={40} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                confirmDeletion(data.item)
                            }}>
                            <FontAwesomeIcon
                                style={[styles.deleteSwipe, { margin: 5 }]}
                                color={'red'}
                                icon={faTrash}
                                size={40} />
                        </TouchableOpacity>
                    </View>
                )}
                leftOpenValue={50}
                rightOpenValue={-50}
            />

            <View style={styles.groupsetButtons}>
                <TouchableOpacity
                    style={styles.secButton}
                    onPress={() => {
                        uploadFile()
                    }}>
                    <Text style={styles.sectextButtonRead}>Importar Leitura</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.readButton}
                    onPress={() => {
                        goToPlot()
                    }}>
                    <Text style={styles.textButtonRead}>Nova Leitura</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default ReadingsList
