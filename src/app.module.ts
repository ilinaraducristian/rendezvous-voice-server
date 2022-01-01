import {Module} from "@nestjs/common";
import Gateway from "./gateway";
import {Router} from "mediasoup/node/lib/Router";
import {createWorker} from "mediasoup";
import {RtpCodecCapability} from "mediasoup/node/lib/RtpParameters";

const mediaCodecs: RtpCodecCapability[] = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2
    },
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters:
            {
                "x-google-start-bitrate": 1000
            }
    },
    {
        kind: "video",
        mimeType: "video/VP9",
        clockRate: 90000,
        parameters:
            {
                "profile-id": 2,
                "x-google-start-bitrate": 1000
            }
    },
    {
        kind: "video",
        mimeType: "video/h264",
        clockRate: 90000,
        parameters:
            {
                "packetization-mode": 1,
                "profile-level-id": "4d0032",
                "level-asymmetry-allowed": 1,
                "x-google-start-bitrate": 1000
            }
    },
    {
        kind: "video",
        mimeType: "video/h264",
        clockRate: 90000,
        parameters:
            {
                "packetization-mode": 1,
                "profile-level-id": "42e01f",
                "level-asymmetry-allowed": 1,
                "x-google-start-bitrate": 1000
            }
    }
];

@Module({
    imports: [],
    providers: [{
        provide: Router,
        useFactory: () => createWorker().then(worker =>
            worker.createRouter({mediaCodecs})
        )
    },
        Gateway
    ]
})
export class AppModule {
}
