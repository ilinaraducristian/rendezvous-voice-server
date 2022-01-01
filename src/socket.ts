import {Socket as SocketIoSocket} from "socket.io";
import {WebRtcTransport} from "mediasoup/node/lib/WebRtcTransport";
import {Producer} from "mediasoup/node/lib/Producer";
import {Consumer} from "mediasoup/node/lib/Consumer";

class Socket extends SocketIoSocket {

    data: {
        producer?: Producer | undefined,
        sendTransport: WebRtcTransport | undefined,
        recvTransport: WebRtcTransport | undefined,
        consumers: Map<string, Consumer> | undefined
    };

}

export default Socket;