// SPDX-License-Identifier: MIT
// @supports: ovm
pragma solidity >0.6.0 <0.8.0;

/**
 * @title MockCrossDomainMessenger
 * @dev L2 CONTRACT (COMPILED)
 */
contract MockCrossDomainMessenger {

    address public xDomainMessageSender;

    /********************
     * Public Functions *
     ********************/

    /**
     * Relays a cross domain message to a contract.
     */

    function simulateRelayMessage(
        address _target,
        address _sender,
        bytes memory _message
    )
        public
    {
        xDomainMessageSender = _sender;
        (bool success, ) = _target.call(_message);
    }

}