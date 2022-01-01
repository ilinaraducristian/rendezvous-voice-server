enum SocketIoServerEvents {
    getChannels = "get-channels",
    getRouterRtpCapabilities = "get-router-rtp-capabilities",
    createProducer = "create-producer",
    joinChannel = "join-channel",
    connectTransport = "connect-transport",
    createConsumer = "create-consumer",
    resumeConsumers = "resume-consumers"
}

export default SocketIoServerEvents;