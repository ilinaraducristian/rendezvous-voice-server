import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer
} from "@nestjs/websockets";
import {Router} from "mediasoup/node/lib/Router";
import Socket from "./socket";
import {ProducerOptions} from "mediasoup/node/lib/Producer";
import SocketIoServerEvents from "./socket.io-server-events";
import {WebRtcTransport} from "mediasoup/node/lib/WebRtcTransport";
import {Server} from "socket.io";
import SocketIoClientEvents from "./socket.io-client-events";

const webRtcTransportOptions = {
    listenIps: [{ip: "192.168.1.4"}],
    enableTcp: true,
    preferUdp: true
};

const extractTransportParameters = (transport: WebRtcTransport) => ({
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
    sctpParameters: transport.sctpParameters
});

const channels = new Map<string, Socket[]>();

@WebSocketGateway({cors: ["*"]})
class Gateway implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket> {

    @WebSocketServer()
    server: Server;

    constructor(
        private readonly router: Router
    ) {
    }

    handleConnection(client: Socket, ...args: any[]) {
    }

    handleDisconnect(client: Socket) {
        channels.forEach(channel => {
            const index = channel.findIndex(socket => socket.id === client.id);
            if (index === -1) return;
            channel.splice(index, 1);
        });
    }

    @SubscribeMessage(SocketIoServerEvents.getRouterRtpCapabilities)
    async getRouterRtpCapabilities() {
        return {
            routerRtpCapabilities: this.router.rtpCapabilities
        };
    }

    @SubscribeMessage(SocketIoServerEvents.joinChannel)
    async joinChannel(client: Socket, {channelId, rtpCapabilities}) {
        const [sendTransport, recvTransport] = await Promise.all([
            this.router.createWebRtcTransport(webRtcTransportOptions),
            this.router.createWebRtcTransport(webRtcTransportOptions)
        ]);

        sendTransport.observer.on("newproducer", async (producer) => {
            const channel = channels.get(channelId) ?? channels.set(channelId, []).get(channelId);
            await Promise.all(channel.map(async (socket) => {
                if (socket.data.recvTransport === undefined) return;
                const consumer = await socket.data.recvTransport.consume({
                    producerId: producer.id,
                    rtpCapabilities,
                    paused: true
                });
                consumer.observer.on("close", () => {
                    socket.data.consumers.delete(consumer.id);
                });
                client.to(socket.id).emit(SocketIoClientEvents.newConsumer, {
                    id: consumer.id,
                    producerId: consumer.producerId,
                    rtpParameters: consumer.rtpParameters,
                    kind: consumer.kind
                });
            }));
        });

        sendTransport.observer.on("close", () => {
            client.data.sendTransport = undefined;
        });

        recvTransport.observer.on("close", () => {
            client.data.recvTransport = undefined;
        });

        const channel = channels.get(channelId) ?? channels.set(channelId, []).get(channelId);
        const consumers = [];
        await Promise.all(channel.map(async (socket) => {
            if (socket.data.producer === undefined) return;
            const consumer = await recvTransport.consume({
                producerId: socket.data.producer.id,
                rtpCapabilities,
                paused: true
            });
            consumer.observer.on("close", () => {
                client.data.consumers.delete(consumer.id);
            });
            consumers.push([consumer.id, consumer]);
        }));

        client.data = {
            sendTransport,
            recvTransport,
            consumers: new Map(consumers)
        };

        channel.push(client);

        return {
            serverSendTransportOptions: extractTransportParameters(sendTransport),
            serverRecvTransportOptions: extractTransportParameters(recvTransport),
            consumers: consumers.map(consumer => ({
                id: consumer[1].id,
                producerId: consumer[1].producerId,
                rtpParameters: consumer[1].rtpParameters,
                kind: consumer[1].kind
            }))
        };
    }

    @SubscribeMessage(SocketIoServerEvents.createProducer)
    async createProducer(client: Socket, payload: Pick<ProducerOptions, "id" | "kind" | "rtpParameters">) {
        const producer = await client.data.sendTransport.produce({
            id: payload.id,
            kind: payload.kind,
            rtpParameters: payload.rtpParameters
        });
        producer.observer.on("close", () => {
            client.data.producer = undefined;
        });
        client.data.producer = producer;
        return {producerId: producer.id};
    }

    @SubscribeMessage(SocketIoServerEvents.connectTransport)
    async connectTransport(client: Socket, {type, dtlsParameters}) {
        if (type === "send") {
            await client.data.sendTransport.connect({dtlsParameters});
        } else if (type === "recv") {
            await client.data.recvTransport.connect({dtlsParameters});
        }
        return 0;
    }

    @SubscribeMessage(SocketIoServerEvents.resumeConsumers)
    async resumeConsumer(client: Socket, {consumersIds}) {
        await Promise.all(consumersIds.map(consumerId =>
            client.data.consumers.get(consumerId)?.resume()
        ));
        return 0;
    }

}

export default Gateway;